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
      throw new Error(`Failed to fetch "${table}": ${error.message}`);
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
