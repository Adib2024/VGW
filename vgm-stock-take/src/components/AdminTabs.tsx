import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useLanguage } from '../contexts/LanguageContext';

// Parts upload / Users switcher shared by the two Admin pages.
export const AdminTabs: React.FC = () => {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { t } = useLanguage();
  const tabs = [
    { path: '/admin/settings', label: t('partsUploadTab') },
    { path: '/admin/users', label: t('users') },
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
