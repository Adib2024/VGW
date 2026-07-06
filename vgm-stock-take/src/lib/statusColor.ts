export type PartStatus = 'Verified' | 'Counted' | string;

export function getStatusColor(status: PartStatus): string {
  switch (status) {
    case 'Verified':
      return 'var(--success-color)';
    case 'Counted':
      return 'var(--warning-color)';
    default:
      return 'var(--danger-color)';
  }
}

export function getStatusBadgeColors(status: PartStatus): { bg: string; text: string } {
  switch (status) {
    case 'Verified':
      return { bg: 'var(--success-bg)', text: 'var(--success-text)' };
    case 'Counted':
      return { bg: 'var(--warning-bg)', text: 'var(--warning-text)' };
    default:
      return { bg: 'var(--danger-bg)', text: 'var(--danger-text)' };
  }
}
