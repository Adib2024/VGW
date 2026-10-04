import React from 'react';
import { useToast } from '../../contexts/ToastContext';
import { XCircle, CheckCircle, Info, X } from 'lucide-react';

export const ToastContainer: React.FC = () => {
  const { toasts, removeToast } = useToast();

  if (toasts.length === 0) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 'calc(16px + env(safe-area-inset-top))',
      left: '16px',
      right: '16px',
      zIndex: 10000,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: '8px',
      pointerEvents: 'none'
    }}>
      {toasts.map((toast) => {
        const isError = toast.type === 'error';
        const isSuccess = toast.type === 'success';
        const accent = isError ? '#FF8A9B' : isSuccess ? '#3DDC97' : 'var(--signal-color)';

        return (
          <div
            key={toast.id}
            role={isError ? 'alert' : 'status'}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              width: '100%',
              maxWidth: '420px',
              backgroundColor: 'var(--primary-color)',
              color: '#fff',
              padding: '12px 8px 12px 16px',
              borderRadius: 'var(--radius-lg)',
              boxShadow: '0 20px 40px -16px rgba(11,27,58,0.6)',
              pointerEvents: 'auto',
              animation: 'ds-rise 0.25s cubic-bezier(0.16, 1, 0.3, 1)'
            }}
          >
            <div style={{ flexShrink: 0, display: 'flex', color: accent }}>
              {isError && <XCircle size={20} />}
              {isSuccess && <CheckCircle size={20} />}
              {!isError && !isSuccess && <Info size={20} />}
            </div>

            <p style={{ margin: 0, flex: 1, fontSize: '0.875rem', fontWeight: 600, color: '#fff' }}>
              {toast.message}
            </p>

            <button
              onClick={() => removeToast(toast.id)}
              aria-label="Dismiss"
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: 'var(--text-on-dark)',
                width: 36,
                height: 36,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <X size={16} />
            </button>
          </div>
        );
      })}
    </div>
  );
};
