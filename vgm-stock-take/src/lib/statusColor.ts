export type PartStatus = 'Verified' | 'Counted' | string;

// Class for the shared .ds-chip status badge. Not Counted is an outline,
// Counted is amber, Verified is solid green — distinguishable by shape and
// lightness, not hue alone.
export function getStatusChipClass(status: PartStatus): string {
  switch (status) {
    case 'Verified':
      return 'st-v';
    case 'Counted':
      return 'st-c';
    default:
      return 'st-nc';
  }
}
