import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireAdmin } from '../_lib/adminAuth.js';
import { generateTempPassword } from '../_lib/tempPassword.js';
import { toEmail, VALID_ROLES, ID_PATTERN, NAME_DISALLOWED_CHARS } from '../_lib/constants.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    await handleCreateUser(req, res);
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Unexpected server error.' });
  }
}

async function handleCreateUser(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const auth = await requireAdmin(req);
  if (!auth.ok) {
    res.status(auth.status).json({ error: auth.error });
    return;
  }
  const serviceClient = auth.serviceClient!;

  const { id, name, role } = (req.body ?? {}) as { id?: string; name?: string; role?: string };
  const trimmedId = id?.trim() ?? '';
  const trimmedName = name?.trim() ?? '';

  if (!ID_PATTERN.test(trimmedId)) {
    res.status(400).json({ error: 'User ID must be 2-32 characters: letters, numbers, underscore, hyphen only.' });
    return;
  }
  if (!trimmedName || trimmedName.length > 100) {
    res.status(400).json({ error: 'Name is required (max 100 characters).' });
    return;
  }
  if (NAME_DISALLOWED_CHARS.test(trimmedName)) {
    res.status(400).json({ error: 'Name cannot contain a "|" character.' });
    return;
  }
  if (!role || !VALID_ROLES.includes(role as any)) {
    res.status(400).json({ error: 'Invalid role.' });
    return;
  }

  const { data: existing } = await serviceClient
    .from('users')
    .select('id')
    .ilike('id', trimmedId)
    .maybeSingle();

  if (existing) {
    res.status(409).json({ error: `User ID "${trimmedId}" already exists.` });
    return;
  }

  const email = toEmail(trimmedId);
  const tempPassword = generateTempPassword();

  const { data: created, error: createError } = await serviceClient.auth.admin.createUser({
    email,
    password: tempPassword,
    email_confirm: true,
  });

  if (createError || !created.user) {
    // A raced double-submit can slip past the pre-check above and collide on
    // the deterministic email - report it the same way the pre-check would,
    // rather than leaking the raw Auth-SDK message.
    if (createError?.message?.toLowerCase().includes('already been registered')) {
      res.status(409).json({ error: `User ID "${trimmedId}" already exists.` });
      return;
    }
    console.error('create-user: auth.admin.createUser failed:', createError);
    res.status(500).json({ error: 'Failed to create account. Please try again.' });
    return;
  }

  const { error: insertError } = await serviceClient.from('users').insert({
    id: trimmedId,
    name: trimmedName,
    role,
    auth_id: created.user.id,
    email,
    must_change_password: true,
    is_active: true,
  });

  if (insertError) {
    // Avoid an orphaned auth user with no matching profile row.
    const { error: rollbackError } = await serviceClient.auth.admin.deleteUser(created.user.id);
    if (rollbackError) {
      console.error(`create-user: rollback FAILED for orphaned auth user ${created.user.id} (id "${trimmedId}"):`, rollbackError);
    }

    // A raced double-submit hitting the unique constraint after both requests
    // passed the pre-check gets the same clean 409 the pre-check gives,
    // instead of a raw Postgres constraint-violation message.
    if (insertError.code === '23505') {
      res.status(409).json({ error: `User ID "${trimmedId}" already exists.` });
      return;
    }
    console.error('create-user: profile insert failed:', insertError);
    res.status(500).json({ error: 'Failed to create profile. Please try again.' });
    return;
  }

  await serviceClient.from('audit_logs').insert({
    user_id: trimmedId,
    action: 'ADMIN_CREATED_USER',
    device_type: `Admin Panel (by ${auth.callerId})`,
  });

  res.status(200).json({ id: trimmedId, name: trimmedName, role, email, tempPassword });
}
