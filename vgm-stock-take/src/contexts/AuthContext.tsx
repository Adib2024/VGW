import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';

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

  const login = (userData: User) => {
    setUser(userData);
    localStorage.setItem('vgm_user', JSON.stringify(userData));
    localStorage.setItem(`last_login_${userData.id}`, new Date().toLocaleString());
  };

  const logout = () => {
    if (user) {
      localStorage.setItem(`last_logout_${user.id}`, new Date().toLocaleString());
    }
    setUser(null);
    localStorage.removeItem('vgm_user');
  };

  useEffect(() => {
    let timeoutId: number;

    const resetTimeout = () => {
      clearTimeout(timeoutId);
      if (user) {
        timeoutId = window.setTimeout(() => {
          logout();
          window.location.href = '/';
        }, 5 * 60 * 1000); // 5 minutes
      }
    };

    if (user) {
      resetTimeout();
      window.addEventListener('mousemove', resetTimeout);
      window.addEventListener('keydown', resetTimeout);
      window.addEventListener('click', resetTimeout);
      window.addEventListener('scroll', resetTimeout);
    }

    return () => {
      clearTimeout(timeoutId);
      window.removeEventListener('mousemove', resetTimeout);
      window.removeEventListener('keydown', resetTimeout);
      window.removeEventListener('click', resetTimeout);
      window.removeEventListener('scroll', resetTimeout);
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
