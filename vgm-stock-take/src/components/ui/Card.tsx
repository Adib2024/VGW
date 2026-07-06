import React from 'react';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
  interactive?: boolean;
  style?: React.CSSProperties;
}

export const Card: React.FC<CardProps> = ({ children, className = '', onClick, interactive = false, style }) => {
  const baseClasses = 'glass-panel rounded-xl p-6';
  const interactiveClasses = interactive ? 'cursor-pointer transition-transform hover:scale-[1.02] hover:shadow-glow' : '';

  return (
    <div
      className={`${baseClasses} ${interactiveClasses} ${className}`}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); } } : undefined}
      style={{ borderRadius: 'var(--radius-xl)', ...style }}
    >
      {children}
    </div>
  );
};
