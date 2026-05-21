import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { Button } from './ui/Button';
import { ChevronLeft, LogOut } from 'lucide-react';

interface NavigationProps {
  title: string;
  showBack?: boolean;
  backTo?: string;
}

export const Navigation: React.FC<NavigationProps> = ({ title, showBack = true, backTo = '/hub' }) => {
  const navigate = useNavigate();
  const { t, language, setLanguage } = useLanguage();
  const { user, logout } = useAuth();

  const handleBack = () => {
    navigate(backTo);
  };

  const handleLogout = () => {
    if (window.confirm('Are you sure you want to log out?')) {
      logout();
      navigate('/');
    }
  };

  return (
    <div style={{ 
      display: 'flex', 
      flexWrap: 'wrap',
      justifyContent: 'space-between', 
      alignItems: 'center', 
      padding: '0.75rem 1rem',
      backgroundColor: 'var(--surface-color)',
      borderBottom: '1px solid var(--border-color)',
      position: 'sticky',
      top: 0,
      zIndex: 50,
      gap: '0.5rem'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: '1 1 auto', minWidth: '0' }}>
        {showBack && (
          <Button variant="secondary" onClick={handleBack} style={{ padding: '0.25rem 0.5rem', minWidth: 'max-content' }}>
            <ChevronLeft size={16} /> <span style={{ fontSize: '0.875rem' }}>{t('back')}</span>
          </Button>
        )}
        <h2 style={{ margin: 0, fontSize: '1.1rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{title}</h2>
      </div>
      
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'nowrap', marginLeft: 'auto' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', color: 'var(--text-secondary)', fontSize: '0.75rem', lineHeight: '1.2' }}>
          <span style={{ fontWeight: 600, color: '#0f172a' }}>{user?.name}</span>
          <span style={{ fontSize: '0.65rem' }}>({user?.role})</span>
        </div>
        <select 
          value={language}
          onChange={(e) => setLanguage(e.target.value as any)}
          style={{ 
            padding: '0.25rem', 
            borderRadius: '999px', 
            border: '1px solid var(--primary-color)', 
            backgroundColor: 'transparent', 
            color: 'var(--primary-color)', 
            fontSize: '0.75rem', 
            fontWeight: 600, 
            outline: 'none', 
            cursor: 'pointer' 
          }}
        >
          <option value="EN">EN</option>
          <option value="BM">BM</option>
          <option value="DE">DE</option>
        </select>
        <Button variant="danger" onClick={handleLogout} style={{ padding: '0.35rem 0.5rem' }} title="Logout">
          <LogOut size={16} />
        </Button>
      </div>
    </div>
  );
};
