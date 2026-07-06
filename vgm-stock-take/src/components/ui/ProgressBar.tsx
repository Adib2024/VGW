import React from 'react';

interface ProgressBarProps {
  percentage: number;
  label?: string;
  showCar?: boolean;
  carDelay?: string;
  carDuration?: string;
}

export const ProgressBar: React.FC<ProgressBarProps> = ({ percentage, label, showCar = false, carDelay = '0s', carDuration = '6s' }) => {
  const safePercentage = Math.min(Math.max(percentage, 0), 100);

  return (
    <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
      {label && (
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem' }}>
          <span style={{ fontWeight: 500 }}>{label}</span>
          <span style={{ color: 'var(--text-secondary)' }}>{safePercentage.toFixed(0)}%</span>
        </div>
      )}
      <div style={{ position: 'relative', width: '100%', height: '50px', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', bottom: '5px', width: '100%', height: '8px', backgroundColor: 'var(--surface-highlight)', borderRadius: '999px' }}>
          <div
            style={{
              width: `${safePercentage}%`,
              height: '100%',
              backgroundColor: safePercentage === 100 ? 'var(--success-color)' : 'var(--primary-color)',
              borderRadius: '999px',
              transition: 'width 0.5s ease-in-out'
            }}
          />
        </div>
        {showCar && (
          <div className="car-icon-anim" style={{ bottom: '8px', animationDelay: carDelay, animationDuration: carDuration }}>
            <img src="/car-golf.webp" alt="car" decoding="async" style={{ width: '80px', height: 'auto', objectFit: 'contain' }} />
          </div>
        )}
      </div>
    </div>
  );
};
