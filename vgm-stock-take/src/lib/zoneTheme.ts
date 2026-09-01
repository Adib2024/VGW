// Shared per-zone visual identity (accent colors, icon tint, car-animation
// stagger) so the Dashboard, List View, etc. all render the same zone the
// same way instead of each page picking its own colors.

export interface ZoneTheme {
  key: string;
  title: string;
  heroLabel: string;
  accent: string;
  accentSoft: string;
  heroDot: string;
  carDelay: string;
  carDuration: string;
}

export const ZONE_ORDER = ['b17', 'b22', 'loma', 'b22_seq'];

export const ZONE_THEME: Record<string, ZoneTheme> = {
  b17: { key: 'b17', title: 'LOCATION B17', heroLabel: 'B17', accent: '#2563eb', accentSoft: 'rgba(37,99,235,0.1)', heroDot: '#60a5fa', carDelay: '0s', carDuration: '15s' },
  b22: { key: 'b22', title: 'LOCATION B22', heroLabel: 'B22', accent: '#e11d48', accentSoft: 'rgba(225,29,72,0.1)', heroDot: '#fb7185', carDelay: '1.5s', carDuration: '16.5s' },
  loma: { key: 'loma', title: 'LOMA', heroLabel: 'Loma', accent: '#059669', accentSoft: 'rgba(5,150,105,0.1)', heroDot: '#34d399', carDelay: '3.2s', carDuration: '14.5s' },
  b22_seq: { key: 'b22_seq', title: 'B22 SEQ', heroLabel: 'B22 seq', accent: '#d97706', accentSoft: 'rgba(217,119,6,0.1)', heroDot: '#fbbf24', carDelay: '4.8s', carDuration: '17s' },
};

// Neutral fallback for views that span more than one zone (e.g. the global
// Check Part list), which has no single zone color to inherit.
export const NEUTRAL_ZONE_THEME: ZoneTheme = {
  key: 'all', title: 'ALL ZONES', heroLabel: 'All', accent: '#001e50', accentSoft: 'rgba(0,30,80,0.08)', heroDot: '#93a5c9', carDelay: '0s', carDuration: '15s',
};
