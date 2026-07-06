import React from 'react';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
  interactive?: boolean;
  style?: React.CSSProperties;
}

export const Card: React.FC<CardProps> = ({ children, className = '', onClick, interactive = false, style }) => {
  const interactiveClasses = interactive ? 'ui-card-interactive' : '';

  return (
    <div
      className={`glass-panel ${interactiveClasses} ${className}`}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); } } : undefined}
      style={{ borderRadius: 'var(--radius-xl)', cursor: interactive ? 'pointer' : undefined, ...style }}
    >
      {children}
    </div>
  );
};
