import React, { InputHTMLAttributes, useId } from 'react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  icon?: React.ReactNode;
  rightElement?: React.ReactNode;
}

export const Input: React.FC<InputProps> = ({ label, error, icon, rightElement, className = '', id, style, ...props }) => {
  const generatedId = useId();
  const inputId = id || generatedId;
  return (
    <div style={{ width: '100%' }}>
      {label && <label htmlFor={inputId} className="ds-label">{label}</label>}
      <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
        {icon && <div style={{ position: 'absolute', left: '0.875rem', color: 'var(--text-secondary)', display: 'flex', pointerEvents: 'none' }}>{icon}</div>}
        <input
          id={inputId}
          aria-invalid={!!error}
          aria-describedby={error ? `${inputId}-error` : undefined}
          className={`ds-fld ${className}`}
          style={{
            paddingLeft: icon ? '2.625rem' : undefined,
            paddingRight: rightElement ? '3.25rem' : undefined,
            borderColor: error ? 'var(--danger-color)' : undefined,
            ...style
          }}
          {...props}
        />
        {rightElement && <div style={{ position: 'absolute', right: '4px', display: 'flex' }}>{rightElement}</div>}
      </div>
      {error && <span id={`${inputId}-error`} style={{ display: 'block', color: 'var(--danger-color)', fontSize: '0.75rem', marginTop: '0.375rem' }}>{error}</span>}
    </div>
  );
};
