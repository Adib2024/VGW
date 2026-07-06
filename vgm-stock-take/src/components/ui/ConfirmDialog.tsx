import React from 'react';
import { Button } from './Button';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'primary' | 'danger';
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  open,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'danger',
  onConfirm,
  onCancel,
}) => {
  if (!open) return null;

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ backgroundColor: '#fff', padding: '2rem', borderRadius: '16px', maxWidth: '380px', width: '90%', textAlign: 'center', boxShadow: '0 10px 25px rgba(0,0,0,0.2)' }}>
        <h3 style={{ margin: '0 0 1rem 0', color: variant === 'danger' ? 'var(--danger-color)' : 'var(--primary-color)', fontSize: '1.25rem', fontWeight: 800 }}>
          {title}
        </h3>
        <p style={{ margin: '0 0 1.5rem 0', color: '#475569', fontSize: '0.95rem', fontWeight: 500 }}>
          {message}
        </p>
        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
          <Button variant="secondary" onClick={onCancel} style={{ flex: 1, backgroundColor: '#f1f5f9', color: '#475569', border: '1px solid #cbd5e1' }}>
            {cancelLabel}
          </Button>
          <Button variant={variant} onClick={onConfirm} style={{ flex: 1 }}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
};
