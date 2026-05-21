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

  const [showLogoutModal, setShowLogoutModal] = React.useState(false);

  const handleBack = () => {
    navigate(backTo);
  };

  const confirmLogout = async () => {
    await logout();
    navigate('/');
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
        <Button variant="danger" onClick={() => setShowLogoutModal(true)} style={{ padding: '0.35rem 0.5rem' }} title="Logout">
          <LogOut size={16} />
        </Button>
      </div>

      {showLogoutModal && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 9999
        }}>
          <div style={{
            backgroundColor: 'white',
            padding: '2rem',
            borderRadius: '16px',
            boxShadow: '0 10px 25px rgba(0,0,0,0.2)',
            textAlign: 'center',
            maxWidth: '350px',
            width: '90%'
          }}>
            <h3 style={{ margin: '0 0 1rem 0', color: '#0f172a', fontSize: '1.25rem', fontWeight: 800 }}>Logout</h3>
            <p style={{ margin: '0 0 1.5rem 0', color: '#475569', fontSize: '0.95rem', fontWeight: 500 }}>Are you sure you want to log out?</p>
            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
              <Button variant="secondary" onClick={() => setShowLogoutModal(false)} style={{ flex: 1, backgroundColor: '#f1f5f9', color: '#475569', border: '1px solid #cbd5e1' }}>
                Cancel
              </Button>
              <Button variant="danger" onClick={confirmLogout} style={{ flex: 1 }}>
                Logout
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
