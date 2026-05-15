import React, { InputHTMLAttributes } from 'react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  icon?: React.ReactNode;
}

export const Input: React.FC<InputProps> = ({ label, error, icon, className = '', ...props }) => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', width: '100%' }}>
      {label && <label style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', fontWeight: 500 }}>{label}</label>}
      <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
        {icon && <div style={{ position: 'absolute', left: '1rem', color: 'var(--text-secondary)' }}>{icon}</div>}
        <input 
          className={className}
          style={{
            width: '100%',
            padding: icon ? '0.75rem 1rem 0.75rem 2.5rem' : '0.75rem 1rem',
            backgroundColor: 'var(--surface-color)',
            border: `1px solid ${error ? 'var(--danger-color)' : 'var(--border-color)'}`,
            borderRadius: 'var(--radius-md)',
            color: 'var(--text-primary)',
            outline: 'none',
            transition: 'border-color 0.2s ease'
          }}
          onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--primary-color)'; }}
          onBlur={(e) => { e.currentTarget.style.borderColor = error ? 'var(--danger-color)' : 'var(--border-color)'; }}
          {...props}
        />
      </div>
      {error && <span style={{ color: 'var(--danger-color)', fontSize: '0.75rem' }}>{error}</span>}
    </div>
  );
};
