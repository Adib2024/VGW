import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export type Role = 'Counter B17' | 'Counter B22' | 'Verifier' | 'Operator Batt' | 'QA Inspector' | 'Admin' | null;

interface User {
  id: string;
  name: string;
  role: Role;
}

interface AuthContextType {
  user: User | null;
  login: (userData: User) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(() => {
    const savedUser = localStorage.getItem('vgm_user');
    return savedUser ? JSON.parse(savedUser) : null;
  });

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

  const login = async (userData: User) => {
    setUser(userData);
    localStorage.setItem('vgm_user', JSON.stringify(userData));
    localStorage.setItem('vgm_last_activity', Date.now().toString());
    
    // Persist to database for audit purposes
    const { error } = await supabase.from('audit_logs').insert({
      user_id: userData.id,
      action: 'LOGIN',
      device_type: getDeviceType()
    });
    if (error) console.error("Error inserting audit log:", error);

    // Update user ping status for server-side auto-logout sweeper
    await supabase.from('users').update({
      is_logged_in: true,
      last_ping: new Date().toISOString()
    }).eq('id', userData.id);
  };

  const logout = async () => {
    if (user) {
      const { error } = await supabase.from('audit_logs').insert({
        user_id: user.id,
        action: 'MANUAL_LOGOUT',
        device_type: getDeviceType()
      });
      if (error) console.error("Error inserting audit log:", error);

      await supabase.from('users').update({
        is_logged_in: false
      }).eq('id', user.id);
    }
    setUser(null);
    localStorage.removeItem('vgm_user');
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
            last_ping: new Date().toISOString() 
          }).eq('id', user.id);
        }

        // If inactive for 5 minutes, log them out locally.
        // The server-side pg_cron sweeper will handle inserting the AUTO_LOGOUT record.
        if (now - lastActivity > 5 * 60 * 1000) {
          clearInterval(heartbeatInterval);
          
          await supabase.from('users').update({
            is_logged_in: false
          }).eq('id', user.id);
          
          setUser(null);
          localStorage.removeItem('vgm_user');
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
    <AuthContext.Provider value={{ user, login, logout }}>
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
