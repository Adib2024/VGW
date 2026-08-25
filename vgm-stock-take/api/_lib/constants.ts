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

// Shared by every endpoint that accepts a user id, so create/reset/deactivate
// all validate it the same way instead of reset-password/set-active only
// truthy-checking it.
export const ID_PATTERN = /^[A-Za-z0-9_-]{2,32}$/;

// Names are pipe-joined into audit-trail-style remark history elsewhere in
// the app (Counting.tsx) and re-split on " | " for display - a name
// containing a literal pipe would corrupt that rendering for every remark
// that user ever leaves.
export const NAME_DISALLOWED_CHARS = /\|/;
