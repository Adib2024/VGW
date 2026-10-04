import React from 'react';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'primary' | 'danger';
  loading?: boolean;
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
  loading = false,
  onConfirm,
  onCancel,
}) => {
  if (!open) return null;

  return (
    <div className="ds-overlay" role="dialog" aria-modal="true" aria-labelledby="confirm-dialog-title">
      <div className="ds-modal">
        <h3 id="confirm-dialog-title" style={{ color: variant === 'danger' ? 'var(--danger-color)' : 'var(--primary-color)' }}>
          {title}
        </h3>
        <p style={{ margin: '0 0 1.5rem', fontSize: '0.9375rem' }}>
          {message}
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '0.625rem' }}>
          <button type="button" className="ds-btn quiet" onClick={onCancel} disabled={loading}>
            {cancelLabel}
          </button>
          <button type="button" className={`ds-btn ${variant === 'danger' ? 'danger' : 'ink'}`} onClick={onConfirm} disabled={loading}>
            {loading ? '...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};
