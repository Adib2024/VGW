import type { VercelRequest } from '@vercel/node';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

// service_role bypasses RLS and Auth entirely - only ever constructed here,
// server-side, from a Vercel-only environment variable. Never VITE_-prefixed
// (those get embedded in the client bundle), never written to .env.
function getServiceClient(): SupabaseClient {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables');
  }
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

// Flat shape (no discriminated union) - Vercel compiles each function file
// in isolation, and relying on `ok`-based narrowing to access status/error
// at the call site does not resolve correctly under that isolated
// compilation (confirmed via a live build: TS2339 "Property does not exist"
// despite type-checking cleanly with a full project view locally). Every
// field is always present so callers never need narrowing to read it.
export interface AdminAuthResult {
  ok: boolean;
  status: number;
  error: string;
  serviceClient: SupabaseClient | null;
  callerAuthId: string | null;
  callerId: string | null;
}

// Verifies the caller's own Supabase session token identifies a real,
// currently-Admin user before any privileged action runs. The token itself
// proves identity (getUser rejects forged/expired tokens); the role check
// against public.users is the actual authorization gate.
export async function requireAdmin(req: VercelRequest): Promise<AdminAuthResult> {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) {
    return { ok: false, status: 401, error: 'Missing Authorization header', serviceClient: null, callerAuthId: null, callerId: null };
  }

  let serviceClient: SupabaseClient;
  try {
    serviceClient = getServiceClient();
  } catch (err: any) {
    return { ok: false, status: 500, error: err.message, serviceClient: null, callerAuthId: null, callerId: null };
  }

  const { data: userData, error: userError } = await serviceClient.auth.getUser(token);
  if (userError || !userData.user) {
    return { ok: false, status: 401, error: 'Invalid or expired session', serviceClient: null, callerAuthId: null, callerId: null };
  }

  const { data: profile, error: profileError } = await serviceClient
    .from('users')
    .select('id, role')
    .eq('auth_id', userData.user.id)
    .single();

  if (profileError || !profile) {
    return { ok: false, status: 403, error: 'No profile found for this session', serviceClient: null, callerAuthId: null, callerId: null };
  }

  if (profile.role !== 'Admin') {
    return { ok: false, status: 403, error: 'Admin role required', serviceClient: null, callerAuthId: null, callerId: null };
  }

  return { ok: true, status: 200, error: '', serviceClient, callerAuthId: userData.user.id, callerId: profile.id };
}
