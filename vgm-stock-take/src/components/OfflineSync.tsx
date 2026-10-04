import { useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { useLanguage } from '../contexts/LanguageContext';
import { flushQueue, getQueue } from '../lib/offlineQueue';

const RETRY_MS = 30_000;

// Sends counts saved while offline as soon as the connection is back (and
// periodically, since the browser's 'online' event isn't fully reliable on
// flaky warehouse Wi-Fi). Renders nothing. Only runs while signed in, since
// the writes need the user's session.
export const OfflineSync: React.FC = () => {
  const { user } = useAuth();
  const { addToast } = useToast();
  const { tf } = useLanguage();

  useEffect(() => {
    if (!user) return;

    const sync = async () => {
      if (!navigator.onLine || getQueue().length === 0) return;
      const { synced } = await flushQueue();
      if (synced > 0) addToast(tf('syncedCounts', { n: synced }), 'success');
    };

    sync();
    window.addEventListener('online', sync);
    const timer = window.setInterval(sync, RETRY_MS);
    return () => {
      window.removeEventListener('online', sync);
      window.clearInterval(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  return null;
};
