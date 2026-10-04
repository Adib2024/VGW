import React from 'react';

interface CarTrackProps {
  percentage: number;
  color: string;
  carDelay?: string;
  carDuration?: string;
  carWidth?: number;
  dark?: boolean;
  height?: number;
}

// Segmented progress bar with the looping VW Golf driving along it.
export const CarTrack: React.FC<CarTrackProps> = ({ percentage, color, carDelay = '0s', carDuration = '15s', carWidth = 72, dark = false, height = 10 }) => {
  const pct = Math.min(Math.max(percentage, 0), 100);
  return (
    // car-golf.webp is 16:9; the track is tall enough for the car to sit on the bar
    <div className="ds-track" style={{ height: `${Math.round(carWidth * 0.5625) + height + 6}px` }}>
      <div
        className={`ds-seg${dark ? ' dark' : ''}`}
        style={{ height }}
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <span style={{ ['--c' as any]: color, width: `${pct}%` }} />
      </div>
      <div className="car-icon-anim" style={{ bottom: `${height + 4}px`, animationDelay: carDelay, animationDuration: carDuration }}>
        <img src="/car-golf.webp" alt="" decoding="async" style={{ width: carWidth, height: 'auto' }} />
      </div>
    </div>
  );
};
