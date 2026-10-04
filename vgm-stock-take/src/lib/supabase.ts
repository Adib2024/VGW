import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Supabase URL or Anon Key is missing. Check your .env file.');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export async function fetchAllRows(table: string, orderColumn = ''): Promise<any[]> {
  let allData: any[] = [];
  let from = 0;
  const step = 1000;
  let hasMore = true;

  while (hasMore) {
    let query = supabase.from(table).select('*');
    if (orderColumn) {
      query = query.order(orderColumn, { ascending: true });
    }
    
    const { data, error } = await query.range(from, from + step - 1);

    if (error) {
      // Must not swallow this - callers treat the resolved array as ground
      // truth. Silently returning whatever was fetched so far (or []) makes
      // a real fetch failure indistinguishable from "this table is
      // genuinely empty" (e.g. renders as a false 0/0, 0% on the Dashboard).
      const err = new Error(`Failed to fetch "${table}": ${error.message}`) as Error & { missingTable?: boolean };
      // PGRST205 = table doesn't exist (zone never uploaded, or cleared via
      // Admin "Unlock & clear") - a normal state, not a failure.
      err.missingTable = error.code === 'PGRST205';
      throw err;
    }

    if (data && data.length > 0) {
      allData = [...allData, ...data];
      from += step;
      if (data.length < step) hasMore = false;
    } else {
      hasMore = false;
    }
  }

  return allData;
}

// Like fetchAllRows, but resolves to null when the table doesn't exist yet,
// so one un-uploaded zone doesn't blank out every other zone on screen.
// Any other error still throws.
export async function fetchRowsIfTableExists(table: string): Promise<any[] | null> {
  try {
    return await fetchAllRows(table);
  } catch (err: any) {
    if (err?.missingTable) return null;
    throw err;
  }
}
