import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { ChevronLeft, LogOut, Lock, UserCog } from 'lucide-react';
import { ConfirmDialog } from './ui/ConfirmDialog';
import { ChangePasswordModal } from './ChangePasswordModal';

interface NavigationProps {
  title: string;
  titleAccessory?: React.ReactNode;
  showBack?: boolean;
  // A fixed path, or -1 to return to whatever page the user actually came
  // from (browser-history back) - use -1 for pages reachable from more than
  // one place (e.g. via the profile menu), where there's no single correct
  // fixed destination.
  backTo?: string | -1;
  extraMenuItems?: (closeMenu: () => void) => React.ReactNode;
  // 'dark' blends the bar into a navy hero directly beneath it (Hub).
  variant?: 'light' | 'dark';
  // Show the VGM brand mark in place of the back button.
  brand?: boolean;
}

export const Navigation: React.FC<NavigationProps> = ({ title, titleAccessory, showBack = true, backTo = '/stock-take', extraMenuItems, variant = 'light', brand = false }) => {
  const navigate = useNavigate();
  const { t, language, setLanguage } = useLanguage();
  const { user, logout } = useAuth();

  const [showMenu, setShowMenu] = React.useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = React.useState(false);
  const [showChangePassword, setShowChangePassword] = React.useState(false);
  const menuRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!showMenu) return;
    const onDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setShowMenu(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [showMenu]);

  const handleBack = () => {
    if (backTo === -1) {
      navigate(-1);
    } else {
      navigate(backTo, { replace: true });
    }
  };

  const confirmLogout = async () => {
    await logout();
    navigate('/');
  };

  const dark = variant === 'dark';
  const initial = user?.name?.charAt(0).toUpperCase() || user?.id?.charAt(0).toUpperCase() || 'U';

  return (
    <>
      <style>{`
        .gnav {
          position: sticky;
          top: 0;
          z-index: 50;
          background: rgba(238, 236, 230, 0.92);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
          padding-top: env(safe-area-inset-top);
        }
        .gnav.dark { background: var(--primary-color); }
        .gnav-inner {
          max-width: 1080px;
          margin: 0 auto;
          height: 68px;
          padding: 0 1rem;
          display: flex;
          align-items: center;
          gap: 0.75rem;
        }
        .gnav-title {
          flex: 1;
          min-width: 0;
          display: flex;
          align-items: center;
          gap: 0.625rem;
          user-select: none;
          -webkit-user-select: none;
        }
        .gnav-title h1 {
          margin: 0;
          font-size: 1.25rem;
          font-weight: 800;
          letter-spacing: -0.01em;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .gnav.dark .gnav-title h1 { color: #fff; }
        .gnav-avatar {
          width: 44px; height: 44px; border-radius: 50%; border: 0; flex-shrink: 0;
          background: var(--primary-color); color: #fff;
          font-family: inherit; font-weight: 800; font-size: 0.9375rem; cursor: pointer;
        }
        .gnav.dark .gnav-avatar { background: rgba(255,255,255,0.1); box-shadow: inset 0 0 0 1.5px rgba(255,255,255,0.25); }
        .profile-menu {
          position: absolute;
          top: calc(100% + 0.5rem);
          right: 0;
          background: var(--surface-color);
          border-radius: var(--radius-lg);
          box-shadow: 0 1px 0 var(--border-color), 0 24px 48px -16px rgba(11,27,58,0.35);
          padding: 0.5rem;
          min-width: 240px;
          display: flex;
          flex-direction: column;
          gap: 0.125rem;
          z-index: 60;
          animation: ds-rise 0.2s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .menu-head { padding: 0.625rem 0.75rem 0.75rem; border-bottom: 1px solid var(--surface-highlight); margin-bottom: 0.25rem; }
        .menu-item {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          min-height: 44px;
          padding: 0 0.75rem;
          border-radius: var(--radius-md);
          border: none;
          background: none;
          width: 100%;
          text-align: left;
          font-family: inherit;
          font-size: 0.875rem;
          font-weight: 700;
          color: var(--text-primary);
          cursor: pointer;
        }
        .menu-item:hover { background: var(--surface-sunken); }
        .menu-item.danger { color: var(--danger-color); }
        .menu-item.danger:hover { background: var(--danger-bg); }
        .menu-lang { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 4px; padding: 0.375rem 0.25rem; }
        .menu-lang button {
          height: 36px; border-radius: var(--radius-full); border: 1.5px solid var(--border-color);
          background: var(--surface-color); font-family: inherit; font-size: 0.75rem; font-weight: 800;
          color: var(--text-secondary); cursor: pointer;
        }
        .menu-lang button.on { background: var(--primary-color); border-color: var(--primary-color); color: #fff; }
      `}</style>

      <header className={`gnav${dark ? ' dark' : ''}`}>
        <div className="gnav-inner">
          {brand ? (
            <div className="vw-badge" style={{ width: 40, height: 40 }}>
              <img src="/vw-logo.svg" alt="VW" />
            </div>
          ) : showBack && (
            <button onClick={handleBack} aria-label={t('back')} className={`ds-iconbtn${dark ? ' on-dark' : ''}`}>
              <ChevronLeft size={22} strokeWidth={2.2} />
            </button>
          )}

          <div className="gnav-title">
            <h1>{title}</h1>
            {titleAccessory}
          </div>

          <div ref={menuRef} style={{ position: 'relative' }}>
            <button
              className="gnav-avatar"
              onClick={() => setShowMenu(!showMenu)}
              aria-label="Account menu"
              aria-expanded={showMenu}
            >
              {initial}
            </button>

            {showMenu && (
              <div className="profile-menu">
                <div className="menu-head">
                  <div className="eyebrow">{t('loggedInAs')}</div>
                  <div style={{ fontSize: '0.9375rem', fontWeight: 800, marginTop: '0.25rem' }}>{user?.name || user?.id}</div>
                  <div style={{ marginTop: '0.375rem' }}><span className="ds-chip">{user?.role}</span></div>
                </div>

                {user?.role === 'Admin' && (
                  <button onClick={() => { setShowMenu(false); navigate('/admin/users'); }} className="menu-item">
                    <UserCog size={18} /> User Management
                  </button>
                )}

                {extraMenuItems && extraMenuItems(() => setShowMenu(false))}

                <button onClick={() => { setShowMenu(false); setShowChangePassword(true); }} className="menu-item">
                  <Lock size={18} /> Change Password
                </button>

                <div className="menu-lang" role="group" aria-label="Language">
                  {(['EN', 'BM', 'DE'] as const).map(code => (
                    <button
                      key={code}
                      type="button"
                      className={language === code ? 'on' : ''}
                      aria-pressed={language === code}
                      onClick={() => { setLanguage(code); setShowMenu(false); }}
                    >
                      {code}
                    </button>
                  ))}
                </div>

                <button onClick={() => { setShowMenu(false); setShowLogoutConfirm(true); }} className="menu-item danger">
                  <LogOut size={18} /> {t('logout')}
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      <ConfirmDialog
        open={showLogoutConfirm}
        title={t('logout')}
        message={t('confirmLogout') || 'Are you sure you want to log out?'}
        confirmLabel={t('logout')}
        cancelLabel={t('cancel') || 'Cancel'}
        onConfirm={confirmLogout}
        onCancel={() => setShowLogoutConfirm(false)}
      />

      <ChangePasswordModal open={showChangePassword} onClose={() => setShowChangePassword(false)} />
    </>
  );
};
