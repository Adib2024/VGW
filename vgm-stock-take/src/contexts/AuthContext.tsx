import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export type Role = 'Counter B17' | 'Counter B22' | 'Verifier' | 'Operator Batt' | 'QA Inspector' | 'Admin' | null;

interface User {
  id: string;
  name: string;
  role: Role;
  email: string;
  mustChangePassword: boolean;
  isActive: boolean;
}

interface LoginResult {
  success: boolean;
  error?: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (id: string, password: string) => Promise<LoginResult>;
  logout: () => void;
  refreshUser: () => Promise<void>;
  changePassword: (newPassword: string) => Promise<LoginResult>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Supabase Auth requires an email; these users log in with a short internal
// ID (e.g. "Test1"), not a real address, so we derive a stable synthetic one.
const EMAIL_DOMAIN = 'vgm-ckd.internal';
const toEmail = (id: string) => `${id.trim().toLowerCase()}@${EMAIL_DOMAIN}`;

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const getDeviceType = () => {
    const ua = navigator.userAgent;
    if (/(tablet|ipad|playbook|silk)|(android(?!.*mobi))/i.test(ua)) {
      return 'Tablet';
    }
    if (/Mobile|Android|iP(hone|od)|IEMobile|BlackBerry|Kindle|Silk-Accelerated|(hpw|web)OS|Opera M(obi|ini)/.test(ua)) {
      return 'Mobile';
    }
    return 'Desktop';
  };

  const fetchProfile = async (): Promise<User | null> => {
    const { data: sessionData } = await supabase.auth.getSession();
    const authUser = sessionData.session?.user;
    if (!authUser) return null;

    const { data, error } = await supabase
      .from('users')
      .select('id, name, role, email, must_change_password, is_active')
      .eq('auth_id', authUser.id)
      .single();

    if (error || !data) return null;

    return {
      id: data.id,
      name: data.name,
      role: data.role as Role,
      email: data.email,
      mustChangePassword: data.must_change_password,
      isActive: data.is_active,
    };
  };

  // Deactivated accounts are primarily blocked at the Supabase Auth level
  // (banned_until, set by api/admin/set-active.ts), which rejects sign-in
  // and token-refresh outright. This is a defense-in-depth check for an
  // edge case: a session already open when an admin deactivates the
  // account mid-shift, caught on the next profile fetch.
  const rejectIfInactive = async (profile: User | null): Promise<boolean> => {
    if (profile && !profile.isActive) {
      await supabase.auth.signOut();
      return true;
    }
    return false;
  };

  useEffect(() => {
    let mounted = true;

    (async () => {
      const profile = await fetchProfile();
      const rejected = await rejectIfInactive(profile);
      if (mounted) {
        setUser(rejected ? null : profile);
        setLoading(false);
      }
    })();

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        if (mounted) setUser(null);
        return;
      }
      // Deferred to a new task: calling other supabase-js auth methods
      // (fetchProfile -> getSession) synchronously inside this callback
      // can deadlock the client's internal session lock, hanging any
      // auth-dependent call made right after (e.g. supabase.rpc(...) in
      // ForcedPasswordChange, right after updateUser triggers USER_UPDATED).
      setTimeout(async () => {
        const profile = await fetchProfile();
        const rejected = await rejectIfInactive(profile);
        if (mounted) setUser(rejected ? null : profile);
      }, 0);
    });

    return () => {
      mounted = false;
      subscription.subscription.unsubscribe();
    };
  }, []);

  const login = async (id: string, password: string): Promise<LoginResult> => {
    const { error: authError } = await supabase.auth.signInWithPassword({
      email: toEmail(id),
      password,
    });

    if (authError) {
      return { success: false, error: 'Invalid credentials. Please try again.' };
    }

    const profile = await fetchProfile();
    if (!profile) {
      await supabase.auth.signOut();
      return { success: false, error: 'Could not load your profile. Contact an admin.' };
    }

    if (!profile.isActive) {
      await supabase.auth.signOut();
      return { success: false, error: 'This account has been deactivated. Contact an admin.' };
    }

    setUser(profile);
    localStorage.setItem('vgm_last_activity', Date.now().toString());

    // Audit/liveness bookkeeping - best-effort, never blocks login on failure.
    supabase.from('audit_logs').insert({
      user_id: profile.id,
      action: 'LOGIN',
      device_type: getDeviceType(),
    }).then(({ error }) => { if (error) console.error('Error inserting audit log:', error); });

    supabase.from('users').update({
      is_logged_in: true,
      last_ping: new Date().toISOString(),
    }).eq('id', profile.id).then(({ error }) => { if (error) console.error('Error updating login ping:', error); });

    return { success: true };
  };

  const logout = async () => {
    if (user) {
      const { error } = await supabase.from('audit_logs').insert({
        user_id: user.id,
        action: 'MANUAL_LOGOUT',
        device_type: getDeviceType(),
      });
      if (error) console.error('Error inserting audit log:', error);

      await supabase.from('users').update({ is_logged_in: false }).eq('id', user.id);
    }
    await supabase.auth.signOut();
    setUser(null);
    localStorage.removeItem('vgm_last_activity');
  };

  const refreshUser = async () => {
    const profile = await fetchProfile();
    const rejected = await rejectIfInactive(profile);
    setUser(rejected ? null : profile);
  };

  const changePassword = async (newPassword: string): Promise<LoginResult> => {
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) return { success: false, error: error.message };
    return { success: true };
  };

  useEffect(() => {
    let heartbeatInterval: number;

    const trackActivity = () => {
      if (user) {
        localStorage.setItem('vgm_last_activity', Date.now().toString());
      }
    };

    if (user) {
      trackActivity();
      window.addEventListener('mousemove', trackActivity);
      window.addEventListener('keydown', trackActivity);
      window.addEventListener('click', trackActivity);
      window.addEventListener('scroll', trackActivity);

      heartbeatInterval = window.setInterval(async () => {
        const lastActivity = parseInt(localStorage.getItem('vgm_last_activity') || '0', 10);
        const now = Date.now();

        // If active in the last 90 seconds, ping the server
        if (now - lastActivity < 90 * 1000) {
          await supabase.from('users').update({
            last_ping: new Date().toISOString(),
          }).eq('id', user.id);
        }

        // If inactive for 5 minutes, log them out locally.
        // The server-side pg_cron sweeper will handle inserting the AUTO_LOGOUT record.
        if (now - lastActivity > 5 * 60 * 1000) {
          clearInterval(heartbeatInterval);

          await supabase.from('users').update({ is_logged_in: false }).eq('id', user.id);
          await supabase.auth.signOut();

          setUser(null);
          localStorage.removeItem('vgm_last_activity');
          window.location.href = '/';
        }
      }, 60 * 1000); // Check every 60 seconds
    }

    return () => {
      clearInterval(heartbeatInterval);
      window.removeEventListener('mousemove', trackActivity);
      window.removeEventListener('keydown', trackActivity);
      window.removeEventListener('click', trackActivity);
      window.removeEventListener('scroll', trackActivity);
    };
  }, [user]);

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, refreshUser, changePassword }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
