import React, { ButtonHTMLAttributes } from 'react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger';
  fullWidth?: boolean;
  as?: keyof JSX.IntrinsicElements | React.ElementType;
}

export const Button: React.FC<ButtonProps> = ({ 
  children, 
  variant = 'primary', 
  fullWidth = false, 
  className = '', 
  as: Component = 'button',
  ...props 
}) => {
  const getVariantStyles = () => {
    switch (variant) {
      case 'primary':
        return { backgroundColor: 'var(--primary-color)', color: 'white', border: 'none' };
      case 'secondary':
        return { backgroundColor: 'transparent', color: 'var(--text-primary)', border: '1px solid var(--border-color)' };
      case 'danger':
        return { backgroundColor: 'var(--danger-color)', color: 'white', border: 'none' };
      default:
        return {};
    }
  };

  const style: React.CSSProperties = {
    ...getVariantStyles(),
    padding: '0.875rem 1.5rem',
    borderRadius: '12px',
    fontWeight: 500,
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    width: fullWidth ? '100%' : 'auto',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '0.5rem'
  };

  return (
    <Component style={style} className={className} {...(props as any)}>
      {children}
    </Component>
  );
};
