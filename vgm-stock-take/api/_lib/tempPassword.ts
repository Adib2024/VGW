// Mirrors api/_lib/tempPassword.js (used by scripts/migrate-users-to-auth.mjs,
// a plain Node script). Kept as a separate .ts copy here rather than a shared
// cross-extension import, to avoid relying on Vercel's function bundler
// resolving a .ts file importing a sibling .js file.
import { randomBytes } from 'crypto';

const UNAMBIGUOUS_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';

export function generateTempPassword(length = 14): string {
  const bytes = randomBytes(length);
  let out = '';
  for (let i = 0; i < length; i++) {
    out += UNAMBIGUOUS_CHARS[bytes[i] % UNAMBIGUOUS_CHARS.length];
  }
  return out;
}
