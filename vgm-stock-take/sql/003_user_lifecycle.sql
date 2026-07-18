-- ============================================================
-- VGM CKD Stock Take — User lifecycle: is_active column
-- ============================================================
-- Additive/safe to run any time. Mirrors the Supabase Auth-level
-- ban (set by api/admin/set-active.ts via banned_until) so the
-- Admin UI can list/filter status without an extra Admin API call
-- per row, and so the app-level login check in AuthContext has a
-- fast, RLS-visible signal to check.
-- ============================================================

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;
