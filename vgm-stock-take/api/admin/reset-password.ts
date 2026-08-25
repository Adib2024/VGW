import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireAdmin } from '../_lib/adminAuth.js';
import { generateTempPassword } from '../_lib/tempPassword.js';
import { ID_PATTERN } from '../_lib/constants.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    await handleResetPassword(req, res);
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Unexpected server error.' });
  }
}

async function handleResetPassword(req: VercelRequest, res: VercelResponse) {
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

  const { id } = (req.body ?? {}) as { id?: string };
  if (typeof id !== 'string' || !ID_PATTERN.test(id)) {
    res.status(400).json({ error: 'Invalid or missing id.' });
    return;
  }

  const { data: target, error: lookupError } = await serviceClient
    .from('users')
    .select('auth_id')
    .eq('id', id)
    .single();

  if (lookupError || !target?.auth_id) {
    res.status(404).json({ error: `User "${id}" not found.` });
    return;
  }

  const tempPassword = generateTempPassword();

  const { error: updateError } = await serviceClient.auth.admin.updateUserById(target.auth_id, {
    password: tempPassword,
  });

  if (updateError) {
    console.error(`reset-password: updateUserById failed for "${id}":`, updateError);
    res.status(500).json({ error: 'Failed to reset password. Please try again.' });
    return;
  }

  await serviceClient.from('users').update({ must_change_password: true }).eq('id', id);

  await serviceClient.from('audit_logs').insert({
    user_id: id,
    action: 'ADMIN_RESET_PASSWORD',
    device_type: `Admin Panel (by ${auth.callerId})`,
  });

  res.status(200).json({ tempPassword });
}
