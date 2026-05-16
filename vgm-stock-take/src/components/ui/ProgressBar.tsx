import React from 'react';

interface ProgressBarProps {
  percentage: number;
  label?: string;
  showCar?: boolean;
}

export const ProgressBar: React.FC<ProgressBarProps> = ({ percentage, label, showCar = false }) => {
  const safePercentage = Math.min(Math.max(percentage, 0), 100);

  return (
    <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
      {label && (
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem' }}>
          <span style={{ fontWeight: 500 }}>{label}</span>
          <span style={{ color: 'var(--text-secondary)' }}>{safePercentage.toFixed(0)}%</span>
        </div>
      )}
      <div style={{ position: 'relative', width: '100%', height: '8px', backgroundColor: 'var(--surface-highlight)', borderRadius: '999px', overflow: 'visible' }}>
        <div
          style={{
            width: `${safePercentage}%`,
            height: '100%',
            backgroundColor: safePercentage === 100 ? 'var(--success-color)' : 'var(--primary-color)',
            borderRadius: '999px',
            transition: 'width 0.5s ease-in-out'
          }}
        />
        {showCar && (
          <div className="car-icon-anim">
            <img src="https://i.postimg.cc/4NMmDwqL/Golf-RL-Blue.webp" alt="car" style={{ width: '40px', height: 'auto', objectFit: 'contain' }} />
          </div>
        )}
      </div>
    </div>
  );
};
