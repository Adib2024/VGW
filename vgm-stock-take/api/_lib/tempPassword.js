// Shared by scripts/migrate-users-to-auth.mjs and the api/admin/* serverless
// functions - one canonical implementation, plain JS so both a raw `node`
// script and Vercel's esbuild-based function bundler can import it directly
// without a build step.
import { randomBytes } from 'crypto';

const UNAMBIGUOUS_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';

export function generateTempPassword(length = 14) {
  const bytes = randomBytes(length);
  let out = '';
  for (let i = 0; i < length; i++) {
    out += UNAMBIGUOUS_CHARS[bytes[i] % UNAMBIGUOUS_CHARS.length];
  }
  return out;
}
