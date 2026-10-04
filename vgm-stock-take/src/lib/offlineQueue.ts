import { supabase } from './supabase';

// Counts saved while the phone has no signal (warehouse dead spots) are kept
// here, in localStorage so they survive the app being closed, and sent in
// order once the connection is back.
//
// Ordering matters: while anything is still queued, new saves are queued
// behind it rather than sent directly, so an older offline count can never
// land on top of a newer one for the same part.

export interface QueuedWrite {
  id: string;
  table: string;
  rowId: string | number;
  updates: Record<string, unknown>;
  queuedAt: string;
  // A non-network failure (e.g. permissions). Kept so it isn't silently
  // dropped, but skipped by later flushes until retried manually.
  lastError?: string;
}

const STORAGE_KEY = 'vgm_offline_queue';
const listeners = new Set<() => void>();
let flushing: Promise<FlushResult> | null = null;

function read(): QueuedWrite[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as QueuedWrite[]) : [];
  } catch {
    return [];
  }
}

// Cached so useSyncExternalStore gets a stable snapshot between changes.
let snapshot: QueuedWrite[] = read();

function write(queue: QueuedWrite[]) {
  snapshot = queue;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(queue));
  } catch {
    // Storage full or blocked - the in-memory snapshot still holds it until reload.
  }
  listeners.forEach(fn => fn());
}

export function getQueue(): QueuedWrite[] {
  return snapshot;
}

export function subscribe(fn: () => void): () => void {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}

export function isNetworkError(error: { message?: string } | null | undefined): boolean {
  if (typeof navigator !== 'undefined' && !navigator.onLine) return true;
  return !!error?.message && /failed to fetch|networkerror|load failed|network request failed|fetch failed/i.test(error.message);
}

function enqueue(table: string, rowId: string | number, updates: Record<string, unknown>): QueuedWrite {
  const item: QueuedWrite = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    table,
    rowId,
    updates,
    queuedAt: new Date().toISOString(),
  };
  write([...snapshot, item]);
  return item;
}

export interface FlushResult {
  synced: number;
  remaining: number;
}

// Sends queued writes oldest-first. Stops at the first network failure
// (still offline); a server-side rejection is recorded on that item and the
// rest continue.
export function flushQueue(options: { retryFailed?: boolean } = {}): Promise<FlushResult> {
  if (flushing) return flushing;
  flushing = (async () => {
    let synced = 0;
    for (const item of [...snapshot]) {
      if (item.lastError && !options.retryFailed) continue;
      if (typeof navigator !== 'undefined' && !navigator.onLine) break;

      const { error } = await supabase.from(item.table).update(item.updates).eq('id', item.rowId);
      if (!error) {
        write(snapshot.filter(q => q.id !== item.id));
        synced++;
      } else if (isNetworkError(error)) {
        break;
      } else {
        write(snapshot.map(q => (q.id === item.id ? { ...q, lastError: error.message } : q)));
      }
    }
    return { synced, remaining: snapshot.length };
  })().finally(() => { flushing = null; });
  return flushing;
}

// Save a row update now if possible, otherwise keep it for later.
export async function updateOrQueue(
  table: string,
  rowId: string | number,
  updates: Record<string, unknown>,
): Promise<'saved' | 'queued'> {
  const offline = typeof navigator !== 'undefined' && !navigator.onLine;

  if (!offline && snapshot.length === 0) {
    const { error } = await supabase.from(table).update(updates).eq('id', rowId);
    if (!error) return 'saved';
    if (!isNetworkError(error)) throw new Error(error.message);
  }

  const item = enqueue(table, rowId, updates);
  if (!offline) await flushQueue();
  return snapshot.some(q => q.id === item.id) ? 'queued' : 'saved';
}
