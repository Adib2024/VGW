import React from 'react';
import { useToast } from '../../contexts/ToastContext';
import { XCircle, CheckCircle, Info, X } from 'lucide-react';

export const ToastContainer: React.FC = () => {
  const { toasts, removeToast } = useToast();

  if (toasts.length === 0) return null;

  return (
    <div style={{
      position: 'fixed',
      top: '20px',
      right: '20px',
      zIndex: 9999,
      display: 'flex',
      flexDirection: 'column',
      gap: '10px',
      pointerEvents: 'none'
    }}>
      {toasts.map((toast) => {
        const isError = toast.type === 'error';
        const isSuccess = toast.type === 'success';
        
        return (
          <div 
            key={toast.id}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              backgroundColor: 'var(--surface-color)',
              borderLeft: `4px solid ${isError ? 'var(--danger-color)' : isSuccess ? 'var(--success-color)' : 'var(--primary-color)'}`,
              padding: '12px 16px',
              borderRadius: 'var(--radius-md)',
              boxShadow: 'var(--shadow-lg)',
              minWidth: '300px',
              maxWidth: '400px',
              pointerEvents: 'auto',
              animation: 'fade-in 0.3s ease-out'
            }}
          >
            <div style={{ flexShrink: 0 }}>
              {isError && <XCircle size={20} color="var(--danger-color)" />}
              {isSuccess && <CheckCircle size={20} color="var(--success-color)" />}
              {!isError && !isSuccess && <Info size={20} color="var(--primary-color)" />}
            </div>
            
            <p style={{ margin: 0, flex: 1, fontSize: '0.875rem', color: 'var(--text-primary)' }}>
              {toast.message}
            </p>
            
            <button 
              onClick={() => removeToast(toast.id)}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: 'var(--text-secondary)',
                padding: '4px',
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
