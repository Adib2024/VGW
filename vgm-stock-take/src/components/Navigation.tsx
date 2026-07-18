import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { ChevronLeft, LogOut, Lock, Eye, EyeOff, Settings, UserCog } from 'lucide-react';
import { ConfirmDialog } from './ui/ConfirmDialog';
import { Input } from './ui/Input';
import { Button } from './ui/Button';

interface NavigationProps {
  title: string;
  titleAccessory?: React.ReactNode;
  showBack?: boolean;
  backTo?: string;
  extraMenuItems?: (closeMenu: () => void) => React.ReactNode;
}

export const Navigation: React.FC<NavigationProps> = ({ title, titleAccessory, showBack = true, backTo = '/stock-take', extraMenuItems }) => {
  const navigate = useNavigate();
  const { t, language, setLanguage } = useLanguage();
  const { user, logout, changePassword } = useAuth();
  const { addToast } = useToast();

  const [showMenu, setShowMenu] = React.useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = React.useState(false);
  const [showChangePassword, setShowChangePassword] = React.useState(false);
  const [newPassword, setNewPassword] = React.useState('');
  const [confirmPassword, setConfirmPassword] = React.useState('');
  const [showPasswordText, setShowPasswordText] = React.useState(false);
  const [changePasswordError, setChangePasswordError] = React.useState('');
  const [changingPassword, setChangingPassword] = React.useState(false);

  const handleBack = () => {
    navigate(backTo, { replace: true });
  };

  const confirmLogout = async () => {
    await logout();
    navigate('/');
  };

  const closeChangePassword = () => {
    setShowChangePassword(false);
    setNewPassword('');
    setConfirmPassword('');
    setChangePasswordError('');
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setChangePasswordError('');

    if (newPassword.length < 8) {
      setChangePasswordError('Password must be at least 8 characters');
      return;
    }
    if (newPassword !== confirmPassword) {
      setChangePasswordError('Passwords do not match');
      return;
    }

    setChangingPassword(true);
    try {
      const result = await changePassword(newPassword);
      if (!result.success) {
        setChangePasswordError(result.error || 'Failed to update password.');
        return;
      }
      addToast('Password updated', 'success');
      closeChangePassword();
    } finally {
      setChangingPassword(false);
    }
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
          color: var(--primary-color);
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
          border-radius: var(--radius-lg);
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
          border-radius: var(--radius-md);
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
          color: var(--danger-color);
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
            <button onClick={handleBack} style={{ border: 'none', background: 'none', cursor: 'pointer', padding: 0, display: 'flex', color: 'var(--primary-color)', marginRight: '0.25rem', flexShrink: 0 }}>
              <ChevronLeft size={24} />
            </button>
          )}
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}>
            {title}
          </span>
          {titleAccessory}
        </div>

        {/* Right: Profile Toggle & Language Indicator */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', position: 'relative' }}>
          <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>
            ({language})
          </span>
          <button 
            onClick={() => setShowMenu(!showMenu)}
            style={{ width: '38px', height: '38px', borderRadius: '50%', background: 'var(--primary-color)', color: 'white', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '1rem', cursor: 'pointer', boxShadow: '0 4px 10px rgba(0,30,80,0.2)' }}
          >
            {user?.name?.charAt(0).toUpperCase() || user?.id?.charAt(0).toUpperCase() || 'U'}
          </button>
          
          {showMenu && (
            <div className="profile-menu">
              <div style={{ padding: '0.5rem 0.75rem', borderBottom: '1px solid #f1f5f9', marginBottom: '0.25rem' }}>
                <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>{t('loggedInAs')}</div>
                <div style={{ fontSize: '0.9rem', color: '#0f172a', fontWeight: 700 }}>{user?.name || user?.id}</div>
                <div style={{ fontSize: '0.7rem', color: 'var(--primary-color)', fontWeight: 800, marginTop: '2px', textTransform: 'uppercase' }}>{user?.role}</div>
              </div>

              {user?.role === 'Admin' && (
                <>
                  <button onClick={() => { setShowMenu(false); navigate('/admin/settings'); }} className="menu-item">
                    <Settings size={16} /> Admin Settings
                  </button>
                  <button onClick={() => { setShowMenu(false); navigate('/admin/users'); }} className="menu-item">
                    <UserCog size={16} /> User Management
                  </button>
                </>
              )}

              {extraMenuItems && extraMenuItems(() => setShowMenu(false))}

              <button onClick={() => { setShowMenu(false); setShowChangePassword(true); }} className="menu-item">
                <Lock size={16} /> Change Password
              </button>

              <div style={{ padding: '0 0.75rem', margin: '0.5rem 0' }}>
                <select value={language} onChange={(e) => { setLanguage(e.target.value as any); setShowMenu(false); }} style={{ width: '100%', padding: '0.5rem', borderRadius: 'var(--radius-md)', border: '1px solid #e2e8f0', background: '#f8fafc', color: '#334155', fontSize: '0.85rem', fontWeight: 600, outline: 'none', cursor: 'pointer' }}>
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

      <ConfirmDialog
        open={showLogoutConfirm}
        title={t('logout')}
        message={t('confirmLogout') || 'Are you sure you want to log out?'}
        confirmLabel={t('logout')}
        cancelLabel={t('cancel') || 'Cancel'}
        onConfirm={confirmLogout}
        onCancel={() => setShowLogoutConfirm(false)}
      />

      {showChangePassword && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div style={{ backgroundColor: '#fff', padding: '2rem', borderRadius: 'var(--radius-lg)', maxWidth: '380px', width: '100%', boxShadow: '0 10px 25px rgba(0,0,0,0.2)' }}>
            <h3 style={{ margin: '0 0 1.25rem 0', color: 'var(--primary-color)', fontSize: '1.25rem', fontWeight: 800 }}>Change Password</h3>
            <form onSubmit={handleChangePassword} className="flex-col gap-4">
              {changePasswordError && (
                <div style={{ padding: '0.75rem 1rem', borderRadius: 'var(--radius-md)', backgroundColor: '#fef2f2', color: 'var(--danger-text)', border: '1px solid #fecaca', fontSize: '0.85rem', fontWeight: 500 }}>
                  {changePasswordError}
                </div>
              )}
              <Input
                label="New Password"
                type={showPasswordText ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                icon={<Lock size={16} />}
                rightElement={(
                  <button type="button" onClick={() => setShowPasswordText(!showPasswordText)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#888', display: 'flex' }}>
                    {showPasswordText ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                )}
              />
              <Input
                label="Confirm Password"
                type={showPasswordText ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                icon={<Lock size={16} />}
              />
              <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem' }}>
                <Button type="button" variant="secondary" onClick={closeChangePassword} style={{ flex: 1, backgroundColor: '#f1f5f9', color: '#475569', border: '1px solid #cbd5e1' }}>
                  Cancel
                </Button>
                <Button type="submit" disabled={changingPassword} style={{ flex: 1 }}>
                  {changingPassword ? '...' : 'Update Password'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
};
