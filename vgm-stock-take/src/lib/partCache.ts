// Last-loaded rows per zone table, kept in memory for the session. Lets a
// counter who walked into a dead spot still open parts from a list they
// already loaded (the List View and Counting screens fall back to this when
// the network request fails). Deliberately not persisted: zone tables can
// be thousands of rows, and stale data across app restarts would mislead.

import type { Part } from '../types/database';

const cache = new Map<string, Part[]>();

export function cacheRows(table: string, rows: Part[]) {
  cache.set(table, rows);
}

export function getCachedRows(table: string): Part[] | undefined {
  return cache.get(table);
}

export function getCachedRow(table: string, id: string | number): Part | undefined {
  return cache.get(table)?.find(r => String(r.id) === String(id));
}

// Reflect a locally-saved (possibly still queued) change in the cache, so
// going back to the list shows it straight away.
export function patchCachedRow(table: string, id: string | number, updates: Record<string, unknown>) {
  const rows = cache.get(table);
  if (!rows) return;
  cache.set(table, rows.map(r => (String(r.id) === String(id) ? { ...r, ...updates } : r)));
}
