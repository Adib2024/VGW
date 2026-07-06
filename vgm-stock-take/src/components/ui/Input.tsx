import React, { InputHTMLAttributes, useId } from 'react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  icon?: React.ReactNode;
  rightElement?: React.ReactNode;
}

export const Input: React.FC<InputProps> = ({ label, error, icon, rightElement, className = '', id, ...props }) => {
  const generatedId = useId();
  const inputId = id || generatedId;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', width: '100%' }}>
      {label && <label htmlFor={inputId} style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', fontWeight: 500 }}>{label}</label>}
      <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
        {icon && <div style={{ position: 'absolute', left: '1rem', color: 'var(--text-secondary)' }}>{icon}</div>}
        <input
          id={inputId}
          aria-invalid={!!error}
          aria-describedby={error ? `${inputId}-error` : undefined}
          className={className}
          style={{
            width: '100%',
            padding: `0.75rem ${rightElement ? '2.5rem' : '1rem'} 0.75rem ${icon ? '2.5rem' : '1rem'}`,
            backgroundColor: props.disabled ? 'var(--disabled-bg)' : 'var(--surface-highlight)',
            border: `1px solid ${error ? 'var(--danger-color)' : props.disabled ? 'var(--border-color)' : 'transparent'}`,
            borderRadius: 'var(--radius-md)',
            color: props.disabled ? 'var(--text-secondary)' : 'var(--text-primary)',
            outline: 'none',
            opacity: props.disabled ? 0.7 : 1,
            cursor: props.disabled ? 'not-allowed' : 'text',
            transition: 'border-color 0.2s ease, background-color 0.2s ease, opacity 0.2s ease',
            ...props.style
          }}
          onFocus={(e) => { 
            e.currentTarget.style.borderColor = 'var(--primary-color)'; 
            e.currentTarget.style.backgroundColor = 'var(--surface-color)'; 
          }}
          onBlur={(e) => { 
            e.currentTarget.style.borderColor = error ? 'var(--danger-color)' : 'transparent'; 
            e.currentTarget.style.backgroundColor = 'var(--surface-highlight)'; 
          }}
          {...props}
        />
        {rightElement && <div style={{ position: 'absolute', right: '1rem' }}>{rightElement}</div>}
      </div>
      {error && <span id={`${inputId}-error`} style={{ color: 'var(--danger-color)', fontSize: '0.75rem' }}>{error}</span>}
    </div>
  );
};
