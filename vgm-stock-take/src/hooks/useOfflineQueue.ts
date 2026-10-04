import { useEffect, useState, useSyncExternalStore } from 'react';
import { getQueue, subscribe } from '../lib/offlineQueue';

export function useOfflineQueue() {
  const queue = useSyncExternalStore(subscribe, getQueue);
  const [online, setOnline] = useState(typeof navigator === 'undefined' ? true : navigator.onLine);

  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);

  return {
    online,
    pending: queue.length,
    failed: queue.filter(q => q.lastError).length,
  };
}
