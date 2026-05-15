import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { Button } from './ui/Button';
import { ChevronLeft, LogOut, User } from 'lucide-react';

interface NavigationProps {
  title: string;
  showBack?: boolean;
  backTo?: string;
}

export const Navigation: React.FC<NavigationProps> = ({ title, showBack = true, backTo = '/hub' }) => {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const { user, logout } = useAuth();

  const handleBack = () => {
    navigate(backTo);
  };

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <div style={{ 
      display: 'flex', 
      justifyContent: 'space-between', 
      alignItems: 'center', 
      padding: '1rem',
      backgroundColor: 'var(--surface-color)',
      borderBottom: '1px solid var(--border-color)',
      position: 'sticky',
      top: 0,
      zIndex: 50
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
        {showBack && (
          <Button variant="secondary" onClick={handleBack} style={{ padding: '0.5rem 1rem' }}>
            <ChevronLeft size={18} /> {t('back')}
          </Button>
        )}
        <h2 style={{ margin: 0, fontSize: '1.25rem' }}>{title}</h2>
      </div>
      
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
          <User size={16} />
          <span className="hidden md:inline">{user?.name} ({user?.role})</span>
        </div>
        <Button variant="danger" onClick={handleLogout} style={{ padding: '0.5rem' }} title="Logout">
          <LogOut size={18} />
        </Button>
      </div>
    </div>
  );
};
