import { useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';

// Subscribes to postgres_changes on every table in `tables` and calls
// `onChange` at most once per `debounceMs` window. A bulk CSV upload fires
// one event per row (a real zone can be 1000+ rows) - without coalescing,
// every open Dashboard/List View client would refetch its entire table once
// per row change instead of once per burst.
export function useRealtimeTables(tables: string[], onChange: () => void, debounceMs = 500) {
  const isMountedRef = useRef(true);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    isMountedRef.current = true;
    let timer: number | undefined;

    const scheduleChange = () => {
      if (!isMountedRef.current) return;
      if (timer) window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        if (isMountedRef.current) onChangeRef.current();
      }, debounceMs);
    };

    const channels = tables.map(table =>
      supabase
        .channel(`${table}-realtime`)
        .on('postgres_changes', { event: '*', schema: 'public', table }, scheduleChange)
        .subscribe()
    );

    return () => {
      isMountedRef.current = false;
      if (timer) window.clearTimeout(timer);
      channels.forEach(ch => supabase.removeChannel(ch));
    };
    // tables.join(',') keeps this from re-subscribing every render when the
    // caller passes an inline array literal (a fresh reference each time).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tables.join(','), debounceMs]);
}
