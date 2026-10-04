import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

// Parts upload / Users switcher shared by the two Admin pages.
export const AdminTabs: React.FC = () => {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const tabs = [
    { path: '/admin/settings', label: 'Parts upload' },
    { path: '/admin/users', label: 'Users' },
  ];
  return (
    <nav className="ds-tabs" aria-label="Admin sections" style={{ marginTop: '0.25rem' }}>
      {tabs.map(tab => (
        <button
          key={tab.path}
          type="button"
          className={`ds-tab ${pathname === tab.path ? 'on' : ''}`}
          aria-current={pathname === tab.path ? 'page' : undefined}
          onClick={() => pathname !== tab.path && navigate(tab.path, { replace: true })}
        >
          {tab.label}
        </button>
      ))}
    </nav>
  );
};
