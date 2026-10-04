import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { LayoutDashboard, LineChart, AlertTriangle, SlidersHorizontal } from 'lucide-react';

export const BottomNav: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { t } = useLanguage();

  // Helper to determine if a tab is active
  const isActive = (path: string, queryParam?: string) => {
    if (queryParam) {
      return location.pathname === path && location.search.includes(queryParam);
    }
    return location.pathname === path && !location.search.includes('table=check_part');
  };

  const handleNavClick = (path: string) => {
    // If currently on dashboard, PUSH to history. If on a tab, REPLACE history.
    // If clicking Dashboard from a tab, POP history so the physical back button returns to Hub.
    const isDashboard = location.pathname === '/stock-take' || location.pathname === '/hub';

    if (path === '/stock-take' || path === '/hub') {
       if (!isDashboard && window.history.state && window.history.state.idx > 0) {
         navigate(-1); // Pop the current tab to return to the Dashboard that pushed it
       } else {
         navigate(path); // Fallback
       }
    } else {
       navigate(path, { replace: !isDashboard });
    }
  };

  const items = [
    { key: 'dash', label: t('dashboard'), path: '/stock-take', icon: LayoutDashboard, active: isActive('/stock-take') || isActive('/hub') || isActive('/stock-take/list') },
    { key: 'progress', label: t('progress') || 'Progress', path: '/reports/progress', icon: LineChart, active: isActive('/reports/progress') },
    { key: 'check', label: t('checkPart'), path: '/stock-take/list?table=check_part', icon: AlertTriangle, active: isActive('/stock-take/list', 'table=check_part') },
    ...(user?.role === 'Admin'
      ? [{ key: 'admin', label: t('admin'), path: '/admin/settings', icon: SlidersHorizontal, active: isActive('/admin/settings') || isActive('/admin/users') }]
      : []),
  ];

  return (
    <>
      <style>{`
        .bottom-nav {
          position: fixed;
          bottom: 0;
          left: 0;
          right: 0;
          z-index: 50;
          background: var(--surface-color);
          border-top: 1px solid var(--border-color);
          display: grid;
          padding-bottom: env(safe-area-inset-bottom);
        }
        .nav-item {
          position: relative;
          height: var(--bottom-nav-h);
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 0.25rem;
          color: var(--text-secondary);
          font-family: inherit;
          font-size: 0.6875rem;
          font-weight: 700;
          background: none;
          border: none;
          cursor: pointer;
        }
        .nav-item.active { color: var(--primary-color); }
        .nav-item.active::before {
          content: '';
          position: absolute;
          top: 0;
          left: 30%;
          right: 30%;
          height: 3px;
          border-radius: 0 0 3px 3px;
          background: var(--signal-color);
        }
        @media (min-width: 768px) {
          .bottom-nav {
            max-width: 520px;
            left: 50%;
            transform: translateX(-50%);
            border-radius: var(--radius-xl) var(--radius-xl) 0 0;
            border: 1px solid var(--border-color);
            border-bottom: 0;
            box-shadow: 0 -12px 30px -18px rgba(11,27,58,0.3);
          }
        }
      `}</style>
      <nav className="bottom-nav" aria-label="Primary" style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}>
        {items.map(({ key, label, path, icon: Icon, active }) => (
          <button
            key={key}
            className={`nav-item ${active ? 'active' : ''}`}
            aria-current={active ? 'page' : undefined}
            onClick={() => handleNavClick(path)}
          >
            <Icon size={24} strokeWidth={active ? 2.4 : 2} />
            <span>{label}</span>
          </button>
        ))}
      </nav>
    </>
  );
};
