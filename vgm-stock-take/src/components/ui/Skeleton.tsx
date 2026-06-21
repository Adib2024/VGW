import React from 'react';

interface SkeletonProps {
  variant?: 'text' | 'heading' | 'card' | 'circle' | 'avatar';
  width?: string;
  height?: string;
  count?: number;
  className?: string;
}

export const Skeleton: React.FC<SkeletonProps> = ({ 
  variant = 'text', 
  width, 
  height, 
  count = 1,
  className = '' 
}) => {
  const getVariantClass = () => {
    switch (variant) {
      case 'heading': return 'skeleton skeleton-heading';
      case 'card': return 'skeleton skeleton-card';
      case 'circle': return 'skeleton skeleton-circle';
      case 'avatar': return 'skeleton skeleton-avatar';
      default: return 'skeleton skeleton-text';
    }
  };

  const items = Array.from({ length: count }, (_, i) => (
    <div 
      key={i} 
      className={`${getVariantClass()} ${className}`}
      style={{ 
        width: width || undefined, 
        height: height || undefined 
      }}
    />
  ));

  return <>{items}</>;
};

/** Pre-built skeleton for a dashboard card */
export const CardSkeleton: React.FC = () => (
  <div className="card" style={{ padding: 'var(--space-5)' }}>
    <div style={{ display: 'flex', gap: 'var(--space-4)', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
      <Skeleton variant="avatar" />
      <div style={{ flex: 1 }}>
        <Skeleton variant="text" width="60%" />
        <Skeleton variant="text" width="40%" />
      </div>
    </div>
    <Skeleton variant="text" width="100%" height="8px" />
  </div>
);

/** Pre-built skeleton for a list item */
export const ListItemSkeleton: React.FC<{ count?: number }> = ({ count = 4 }) => (
  <>
    {Array.from({ length: count }, (_, i) => (
      <div key={i} className="card" style={{ padding: 'var(--space-5)', marginBottom: 'var(--space-3)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 'var(--space-3)' }}>
          <Skeleton variant="text" width="30%" />
          <Skeleton variant="text" width="20%" />
        </div>
        <Skeleton variant="text" width="80%" />
        <Skeleton variant="text" width="50%" />
      </div>
    ))}
  </>
);
