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
  };

  const logout = async () => {
    if (user) {
      const { error } = await supabase.from('audit_logs').insert({
        user_id: user.id,
        action: 'MANUAL_LOGOUT',
        device_type: getDeviceType()
      });
      if (error) console.error("Error inserting audit log:", error);
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
        if (now - lastActivity > 5 * 60 * 1000) { // 5 minutes
          clearInterval(heartbeatInterval);
          
          await supabase.from('audit_logs').insert({
            user_id: user.id,
            action: 'AUTO_LOGOUT',
            device_type: getDeviceType()
          });
          
          setUser(null);
          localStorage.removeItem('vgm_user');
          window.location.href = '/';
        }
      }, 1000);
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
