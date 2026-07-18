// Kept in sync with src/contexts/AuthContext.tsx's EMAIL_DOMAIN/Role - these
// can't share an import (browser bundle vs. serverless function bundle), so
// this is the one other place that needs updating if either ever changes.
export const EMAIL_DOMAIN = 'vgm-ckd.internal';

export const VALID_ROLES = [
  'Counter B17',
  'Counter B22',
  'Verifier',
  'Operator Batt',
  'QA Inspector',
  'Admin',
] as const;

export type ValidRole = (typeof VALID_ROLES)[number];

export const toEmail = (id: string) => `${id.trim().toLowerCase()}@${EMAIL_DOMAIN}`;
