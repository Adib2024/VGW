// ============================================================
// VGM CKD Stock Take — Stage 2: one-time user migration
// ============================================================
// Creates a real Supabase Auth user for every profile row in
// public.users that doesn't have one yet, links it via auth_id,
// and prints a temporary password for each user for you to
// distribute manually. Safe to re-run — already-migrated users
// (auth_id already set) are skipped.
//
// Run sql/001_auth_migration.sql FIRST, and the pre-flight
// collision check at the bottom of that file, before this script.
//
// Usage (run locally — never in CI, never commit the key):
//   SUPABASE_URL=https://xxxx.supabase.co \
//   SUPABASE_SERVICE_ROLE_KEY=eyJ... \
//   node scripts/migrate-users-to-auth.mjs
//
// Get the service_role key from the Supabase dashboard:
//   Project Settings -> API -> service_role secret key.
// It bypasses RLS and Auth entirely - keep it out of the repo,
// out of chat, out of anywhere it could be committed or logged
// long-term. This script only reads it from the environment.
// ============================================================

import { createClient } from '@supabase/supabase-js';
import { generateTempPassword } from '../api/_lib/tempPassword.js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables.');
  console.error('Usage: SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/migrate-users-to-auth.mjs');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const EMAIL_DOMAIN = 'vgm-ckd.internal';

async function main() {
  const { data: users, error } = await supabase
    .from('users')
    .select('id, name, role, auth_id');

  if (error) {
    console.error('Failed to read public.users:', error.message);
    process.exit(1);
  }

  const pending = users.filter(u => !u.auth_id);

  if (pending.length === 0) {
    console.log('Nothing to do - every user already has auth_id set.');
    return;
  }

  console.log(`Migrating ${pending.length} of ${users.length} users...\n`);
  const results = [];

  for (const user of pending) {
    const email = `${user.id.trim().toLowerCase()}@${EMAIL_DOMAIN}`;
    const tempPassword = generateTempPassword();

    const { data: created, error: createError } = await supabase.auth.admin.createUser({
      email,
      password: tempPassword,
      email_confirm: true,
    });

    if (createError) {
      console.error(`FAILED for ${user.id}: ${createError.message}`);
      continue;
    }

    const { error: updateError } = await supabase
      .from('users')
      .update({
        auth_id: created.user.id,
        email,
        must_change_password: true,
      })
      .eq('id', user.id);

    if (updateError) {
      console.error(`Created auth user for ${user.id} but failed to link profile: ${updateError.message}`);
      console.error(`  -> auth_id to link manually: ${created.user.id}`);
      continue;
    }

    results.push({ id: user.id, name: user.name, role: user.role, email, tempPassword });
  }

  console.log('\nDone. Temporary passwords (distribute these manually, then delete this output):\n');
  console.table(results);
}

main();
