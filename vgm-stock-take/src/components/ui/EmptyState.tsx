import React from 'react';
import { Inbox } from 'lucide-react';

interface EmptyStateProps {
  icon?: React.ReactNode;
  message: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({ icon, message }) => (
  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '0.75rem', padding: '3rem 1rem', color: 'var(--text-secondary)' }}>
    <div style={{ opacity: 0.5 }}>
      {icon || <Inbox size={40} strokeWidth={1.5} />}
    </div>
    <p style={{ margin: 0, fontSize: '0.9rem', fontWeight: 500 }}>{message}</p>
  </div>
);
