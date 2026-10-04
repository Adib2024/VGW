// Shared per-zone visual identity (accent colors, short code, car-animation
// stagger) so the Dashboard, List View, etc. all render the same zone the
// same way instead of each page picking its own colors.

export interface ZoneTheme {
  key: string;
  title: string;
  code: string;
  kind: string;
  accent: string;
  accentSoft: string;
  carDelay: string;
  carDuration: string;
}

export const ZONE_ORDER = ['b17', 'b22', 'loma', 'b22_seq'];

export const ZONE_THEME: Record<string, ZoneTheme> = {
  b17: { key: 'b17', title: 'Location B17', code: 'B17', kind: 'Location', accent: '#2D5BFF', accentSoft: '#E5ECFF', carDelay: '0s', carDuration: '15s' },
  b22: { key: 'b22', title: 'Location B22', code: 'B22', kind: 'Location', accent: '#D92D4A', accentSoft: '#FDE4E8', carDelay: '1.5s', carDuration: '16.5s' },
  loma: { key: 'loma', title: 'LOMA', code: 'LOMA', kind: 'Area', accent: '#0B8A5E', accentSoft: '#DDF3EA', carDelay: '3.2s', carDuration: '14.5s' },
  b22_seq: { key: 'b22_seq', title: 'B22 SEQ', code: 'B22 SEQ', kind: 'Sequence', accent: '#C76A00', accentSoft: '#FFF0D1', carDelay: '4.8s', carDuration: '17s' },
  check_part: { key: 'check_part', title: 'Check Part', code: 'CHECK PART', kind: 'Flagged', accent: '#0B1B3A', accentSoft: '#FFF4D6', carDelay: '0s', carDuration: '15s' },
};

// Neutral fallback for views that span more than one zone (e.g. the global
// list), which has no single zone color to inherit.
export const NEUTRAL_ZONE_THEME: ZoneTheme = {
  key: 'all', title: 'All Zones', code: 'ALL', kind: 'Zones', accent: '#0B1B3A', accentSoft: '#E2DFD7', carDelay: '0s', carDuration: '15s',
};
