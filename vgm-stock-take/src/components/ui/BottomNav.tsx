import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { LayoutDashboard, Users, AlertTriangle, Settings } from 'lucide-react';

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

  return (
    <>
      <style>{`
        .bottom-nav {
          position: fixed;
          bottom: 0;
          left: 0;
          right: 0;
          background: rgba(255, 255, 255, 0.95);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          border-top: 1px solid rgba(0,0,0,0.05);
          display: flex;
          justify-content: space-around;
          align-items: center;
          padding: 0.75rem 1rem;
          padding-bottom: calc(0.75rem + env(safe-area-inset-bottom));
          z-index: 50;
          box-shadow: 0 -4px 20px rgba(0,0,0,0.03);
        }
        .nav-item {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 0.35rem;
          color: #94a3b8;
          font-size: 0.65rem;
          font-weight: 700;
          background: none;
          border: none;
          padding: 0.25rem 0.5rem;
          cursor: pointer;
          transition: color 0.2s;
        }
        .nav-item.active {
          color: #001e50;
        }
        .nav-item svg {
          transition: transform 0.2s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .nav-item.active svg {
          transform: scale(1.15);
        }
        @media (min-width: 768px) {
          .bottom-nav {
            max-width: 500px;
            left: 50%;
            transform: translateX(-50%);
            border-radius: 24px 24px 0 0;
            border-left: 1px solid rgba(0,0,0,0.05);
            border-right: 1px solid rgba(0,0,0,0.05);
            padding: 0.75rem 2rem;
          }
        }
      `}</style>
      <div className="bottom-nav">
        <button 
          className={`nav-item ${isActive('/stock-take') || isActive('/hub') ? 'active' : ''}`} 
          onClick={() => navigate('/stock-take', { replace: true })}
        >
          <LayoutDashboard size={24} strokeWidth={isActive('/stock-take') || isActive('/hub') ? 2.5 : 2} />
          <span>Dashboard</span>
        </button>
        
        <button 
          className={`nav-item ${isActive('/reports/progress') ? 'active' : ''}`} 
          onClick={() => navigate('/reports/progress', { replace: true })}
        >
          <Users size={24} strokeWidth={isActive('/reports/progress') ? 2.5 : 2} />
          <span>{t('userProgress') || 'Progress'}</span>
        </button>
        
        <button 
          className={`nav-item ${isActive('/stock-take/list', 'table=check_part') ? 'active' : ''}`} 
          onClick={() => navigate('/stock-take/list?table=check_part', { replace: true })}
        >
          <AlertTriangle size={24} strokeWidth={isActive('/stock-take/list', 'table=check_part') ? 2.5 : 2} />
          <span>Check Part</span>
        </button>
        
        {user?.role === 'Admin' && (
          <button 
            className={`nav-item ${isActive('/admin/settings') ? 'active' : ''}`} 
            onClick={() => navigate('/admin/settings', { replace: true })}
          >
            <Settings size={24} strokeWidth={isActive('/admin/settings') ? 2.5 : 2} />
            <span>Admin</span>
          </button>
        )}
      </div>
    </>
  );
};
