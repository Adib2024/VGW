-- ============================================================
-- VGM CKD Stock Take — close PUBLIC execute grants
-- ============================================================
-- Postgres automatically grants EXECUTE to PUBLIC on every newly created
-- function unless explicitly revoked. sql/001_auth_migration.sql only ever
-- did `GRANT EXECUTE ... TO authenticated` for its four new functions -
-- additive, not a replacement for the implicit PUBLIC grant. And
-- sql/002_rls_lockdown.sql's `REVOKE EXECUTE ... FROM anon, authenticated`
-- on the legacy verify_password/create_dynamic_table RPCs never touches a
-- PUBLIC grant either. If either legacy function was originally created
-- with the (default) PUBLIC grant still in place - plausible, since neither
-- has a CREATE FUNCTION anywhere in this repo, meaning both predate it -
-- it may still be callable by anyone holding the public anon key, which is
-- the exact pre-migration hole this whole effort was meant to close.
--
-- Safe to run regardless of current state - REVOKE on a grant that was
-- never held, or on a function that doesn't exist, is a no-op, not an error.
-- ============================================================

REVOKE EXECUTE ON FUNCTION public.verify_password(TEXT, TEXT) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.create_dynamic_table(TEXT) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.current_user_role() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.clear_must_change_password() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.admin_create_zone_table(TEXT, TEXT[]) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.admin_drop_zone_table(TEXT) FROM PUBLIC;

-- Re-grant only what's actually needed (idempotent, matches the original intent).
GRANT EXECUTE ON FUNCTION public.current_user_role() TO authenticated;
GRANT EXECUTE ON FUNCTION public.clear_must_change_password() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_create_zone_table(TEXT, TEXT[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_drop_zone_table(TEXT) TO authenticated;

-- Prevent recurrence: makes "no implicit PUBLIC access" the default for
-- every function created in this schema from now on, so a future migration
-- that forgets an explicit REVOKE fails safe instead of failing open.
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;

-- ============================================================
-- VERIFICATION — run after this script. can_exec should be false for
-- every anon/public row; authenticated should be true only for the four
-- new functions (not verify_password/create_dynamic_table).
-- ============================================================
-- SELECT p.proname, r.rolname, has_function_privilege(r.oid, p.oid, 'EXECUTE') AS can_exec
-- FROM pg_proc p CROSS JOIN (SELECT oid, rolname FROM pg_roles WHERE rolname IN ('anon','authenticated','public')) r
-- WHERE p.proname IN ('verify_password','create_dynamic_table','current_user_role',
--                      'clear_must_change_password','admin_create_zone_table','admin_drop_zone_table')
--   AND p.pronamespace = 'public'::regnamespace;
