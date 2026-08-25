import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireAdmin } from '../_lib/adminAuth.js';
import { ID_PATTERN } from '../_lib/constants.js';

// Supabase's ban mechanism has no literal "forever" - a duration far beyond
// any realistic account lifetime is the standard way to express it.
const INDEFINITE_BAN = '876000h'; // 100 years

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    await handleSetActive(req, res);
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Unexpected server error.' });
  }
}

async function handleSetActive(req: VercelRequest, res: VercelResponse) {
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

  const { id, active } = (req.body ?? {}) as { id?: string; active?: boolean };
  if (typeof id !== 'string' || !ID_PATTERN.test(id) || typeof active !== 'boolean') {
    res.status(400).json({ error: 'Invalid or missing id/active.' });
    return;
  }

  if (!active && id === auth.callerId) {
    res.status(400).json({ error: 'You cannot deactivate your own account.' });
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

  const { error: banError } = await serviceClient.auth.admin.updateUserById(target.auth_id, {
    ban_duration: active ? 'none' : INDEFINITE_BAN,
  });

  if (banError) {
    console.error(`set-active: updateUserById failed for "${id}":`, banError);
    res.status(500).json({ error: 'Failed to update account status. Please try again.' });
    return;
  }

  await serviceClient.from('users').update({ is_active: active }).eq('id', id);

  await serviceClient.from('audit_logs').insert({
    user_id: id,
    action: active ? 'ADMIN_REACTIVATED_USER' : 'ADMIN_DEACTIVATED_USER',
    device_type: `Admin Panel (by ${auth.callerId})`,
  });

  res.status(200).json({ success: true });
}
