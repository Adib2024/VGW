import React from 'react';
import { Inbox } from 'lucide-react';

interface EmptyStateProps {
  icon?: React.ReactNode;
  message: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({ icon, message }) => (
  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '0.75rem', padding: '3rem 1rem', color: 'var(--text-secondary)', textAlign: 'center' }}>
    <div style={{ width: 72, height: 72, borderRadius: '50%', background: 'var(--surface-highlight)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      {icon || <Inbox size={36} strokeWidth={1.5} />}
    </div>
    <p style={{ margin: 0, fontSize: '0.9375rem', fontWeight: 600 }}>{message}</p>
  </div>
);
