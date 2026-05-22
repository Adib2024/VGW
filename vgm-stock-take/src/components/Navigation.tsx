import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { ChevronLeft, LogOut } from 'lucide-react';

interface NavigationProps {
  title: string;
  showBack?: boolean;
  backTo?: string;
}

export const Navigation: React.FC<NavigationProps> = ({ title, showBack = true, backTo = '/stock-take' }) => {
  const navigate = useNavigate();
  const { t, language, setLanguage } = useLanguage();
  const { user, logout } = useAuth();
  
  const [showMenu, setShowMenu] = React.useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = React.useState(false);

  const handleBack = () => {
    navigate(backTo, { replace: true });
  };

  const confirmLogout = async () => {
    await logout();
    navigate('/');
  };

  return (
    <>
      <style>{`
        .global-nav-header {
          position: sticky;
          top: 0;
          z-index: 50;
          background: rgba(255, 255, 255, 0.85);
          backdrop-filter: blur(16px);
          -webkit-backdrop-filter: blur(16px);
          border-bottom: 1px solid rgba(0,0,0,0.05);
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 1rem 1.25rem;
          margin-bottom: 1.5rem;
        }
        .global-nav-title {
          font-size: 1.15rem;
          font-weight: 800;
          color: #001e50;
          margin: 0;
          letter-spacing: -0.02em;
          display: flex;
          align-items: center;
          gap: 0.5rem;
          flex: 1;
          min-width: 0;
          user-select: none;
          -webkit-user-select: none;
        }
        .profile-menu {
          position: absolute;
          top: 100%;
          right: 0;
          margin-top: 0.5rem;
          background: white;
          border-radius: 16px;
          box-shadow: 0 10px 40px rgba(0,0,0,0.1);
          border: 1px solid #f1f5f9;
          padding: 0.5rem;
          min-width: 200px;
          display: flex;
          flex-direction: column;
          gap: 0.25rem;
          z-index: 60;
          animation: slideDown 0.2s cubic-bezier(0.16, 1, 0.3, 1);
        }
        @keyframes slideDown {
          from { opacity: 0; transform: translateY(-10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .menu-item {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          padding: 0.75rem;
          border-radius: 10px;
          border: none;
          background: none;
          width: 100%;
          text-align: left;
          font-size: 0.85rem;
          font-weight: 600;
          color: #334155;
          cursor: pointer;
        }
        .menu-item:hover {
          background: #f8fafc;
        }
        .menu-item.danger {
          color: #ef4444;
        }
        .menu-item.danger:hover {
          background: #fef2f2;
        }
        @media (min-width: 768px) {
          .global-nav-header {
            padding: 1.5rem 2rem;
            margin-bottom: 2.5rem;
            border-bottom: 1px solid rgba(0,0,0,0.02);
            background: rgba(248, 250, 252, 0.9);
          }
          .global-nav-title {
            font-size: 1.5rem;
            user-select: none;
            -webkit-user-select: none;
          }
        }
      `}</style>
      
      <div className="global-nav-header">
        {/* Left: Brand & Title */}
        <div className="global-nav-title">
          {showBack && (
            <button onClick={handleBack} style={{ border: 'none', background: 'none', cursor: 'pointer', padding: 0, display: 'flex', color: '#001e50', marginRight: '0.25rem', flexShrink: 0 }}>
              <ChevronLeft size={24} />
            </button>
          )}
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}>
            {title}
          </span>
        </div>

        {/* Right: Profile Toggle & Language Indicator */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', position: 'relative' }}>
          <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>
            ({language})
          </span>
          <button 
            onClick={() => setShowMenu(!showMenu)}
            style={{ width: '38px', height: '38px', borderRadius: '50%', background: '#001e50', color: 'white', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '1rem', cursor: 'pointer', boxShadow: '0 4px 10px rgba(0,30,80,0.2)' }}
          >
            {user?.name?.charAt(0).toUpperCase() || user?.id?.charAt(0).toUpperCase() || 'U'}
          </button>
          
          {showMenu && (
            <div className="profile-menu">
              <div style={{ padding: '0.5rem 0.75rem', borderBottom: '1px solid #f1f5f9', marginBottom: '0.25rem' }}>
                <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>{t('loggedInAs')}</div>
                <div style={{ fontSize: '0.9rem', color: '#0f172a', fontWeight: 700 }}>{user?.name || user?.id}</div>
                <div style={{ fontSize: '0.7rem', color: '#1877f2', fontWeight: 800, marginTop: '2px', textTransform: 'uppercase' }}>{user?.role}</div>
              </div>
              
              <div style={{ padding: '0 0.75rem', margin: '0.5rem 0' }}>
                <select value={language} onChange={(e) => { setLanguage(e.target.value as any); setShowMenu(false); }} style={{ width: '100%', padding: '0.5rem', borderRadius: '8px', border: '1px solid #e2e8f0', background: '#f8fafc', color: '#334155', fontSize: '0.85rem', fontWeight: 600, outline: 'none', cursor: 'pointer' }}>
                  <option value="EN">English</option>
                  <option value="BM">Bahasa Melayu</option>
                  <option value="DE">Deutsch</option>
                </select>
              </div>
              
              <button onClick={() => { setShowMenu(false); setShowLogoutConfirm(true); }} className="menu-item danger">
                <LogOut size={16} /> {t('logout')}
              </button>
            </div>
          )}
        </div>
      </div>

      {showLogoutConfirm && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ backgroundColor: '#fff', padding: '2rem', borderRadius: '16px', maxWidth: '320px', width: '90%', textAlign: 'center' }}>
            <h3 style={{ margin: '0 0 1rem 0', color: '#001e50' }}>{t('logout')}</h3>
            <p style={{ margin: '0 0 2rem 0', color: '#666' }}>{t('confirmLogout') || 'Are you sure you want to log out?'}</p>
            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
              <button onClick={() => setShowLogoutConfirm(false)} style={{ padding: '0.5rem 1.5rem', borderRadius: '8px', border: '1px solid #ccc', background: '#fff', cursor: 'pointer', fontWeight: 600 }}>{t('cancel') || 'Cancel'}</button>
              <button onClick={confirmLogout} style={{ padding: '0.5rem 1.5rem', borderRadius: '8px', border: 'none', background: 'red', color: '#fff', cursor: 'pointer', fontWeight: 600 }}>{t('logout')}</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
