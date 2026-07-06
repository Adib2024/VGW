import React from 'react';

export const BackgroundDecor: React.FC = () => (
  <>
    <div style={{ position: 'fixed', top: '-12%', right: '-12%', width: '500px', height: '500px', background: 'radial-gradient(circle, rgba(0,30,80,0.14) 0%, rgba(0,30,80,0) 70%)', borderRadius: '50%', pointerEvents: 'none', zIndex: 0 }} />
    <div style={{ position: 'fixed', bottom: '-15%', left: '-12%', width: '450px', height: '450px', background: 'radial-gradient(circle, rgba(0,30,80,0.1) 0%, rgba(0,30,80,0) 70%)', borderRadius: '50%', pointerEvents: 'none', zIndex: 0 }} />
  </>
);
