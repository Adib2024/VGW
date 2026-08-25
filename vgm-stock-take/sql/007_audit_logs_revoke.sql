-- ============================================================
-- VGM CKD Stock Take — belt-and-suspenders audit_logs tamper protection
-- ============================================================
-- audit_logs currently has no UPDATE/DELETE policy at all. Confirmed
-- Postgres behavior: with RLS enabled and zero policies defined for a given
-- command, that command is denied outright for any role that isn't the
-- table owner or BYPASSRLS - so this is already genuine default-deny, not a
-- live hole. But it rests entirely on nobody ever adding a permissive
-- UPDATE/DELETE policy later - the same failure class that caused the
-- earlier RLS-bypass incident (a differently-named, forgotten policy
-- silently coexisting with the intended restrictive ones). This makes the
-- protection explicit instead of implicit, so it survives that mistake too.
-- ============================================================

REVOKE UPDATE, DELETE ON public.audit_logs FROM authenticated, anon;
