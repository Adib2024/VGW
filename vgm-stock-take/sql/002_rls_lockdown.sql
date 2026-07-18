-- ============================================================
-- VGM CKD Stock Take — Stage 4: RLS lockdown (BREAKING)
-- ============================================================
-- DO NOT RUN THIS until ALL of the following are true:
--   1. sql/001_auth_migration.sql has been run.
--   2. scripts/migrate-users-to-auth.mjs has been run for every user.
--   3. The Stage 3 app code (real Supabase Auth login, forced
--      password change, new admin RPCs) is deployed and confirmed
--      live in production.
--   4. Every shop-floor tablet/PWA tab has picked up the new code.
--      This app auto-updates but the update prompt is dismissible,
--      so a tab can sit on old code for a full shift. Check Supabase
--      logs (Database > Logs, or pg_stat_statements) and confirm
--      calls to verify_password / create_dynamic_table have dropped
--      to zero, or ask users to fully close and reopen the app once.
--
-- Once RLS is enabled below, any client still running the OLD app
-- code (old anon-only, no Supabase Auth session) loses all data
-- access immediately. That is the intended effect — but only once
-- you've confirmed nothing is still relying on it.
-- ============================================================

-- ------------------------------------------------------------
-- STEP 1: Enable RLS on the 5 zone tables created by setup.sql.
-- (Tables created later via admin_create_zone_table already have
-- RLS enabled and these same policies applied at creation time —
-- this step only needs to run once for the original tables.)
-- ------------------------------------------------------------
ALTER TABLE public.b17 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.b22 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loma ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.b22_seq ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.check_part ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['b17', 'b22', 'loma', 'b22_seq', 'check_part'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS "authenticated_select" ON %I', t);
    EXECUTE format('CREATE POLICY "authenticated_select" ON %I FOR SELECT USING (auth.uid() IS NOT NULL)', t);

    EXECUTE format('DROP POLICY IF EXISTS "authenticated_insert" ON %I', t);
    EXECUTE format('CREATE POLICY "authenticated_insert" ON %I FOR INSERT WITH CHECK (auth.uid() IS NOT NULL)', t);

    EXECUTE format('DROP POLICY IF EXISTS "authenticated_update" ON %I', t);
    EXECUTE format('CREATE POLICY "authenticated_update" ON %I FOR UPDATE USING (auth.uid() IS NOT NULL)', t);
  END LOOP;
END;
$$;

-- ------------------------------------------------------------
-- STEP 2: battery_tracking. Same "any authenticated user" tier —
-- reachable by Admin + Operator Batt, both authenticated roles;
-- no per-role column split exists in the app today (out of scope,
-- see the plan's "explicitly out of scope" section).
-- ------------------------------------------------------------
ALTER TABLE public.battery_tracking ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "authenticated_select" ON public.battery_tracking;
CREATE POLICY "authenticated_select" ON public.battery_tracking FOR SELECT USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "authenticated_insert" ON public.battery_tracking;
CREATE POLICY "authenticated_insert" ON public.battery_tracking FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "authenticated_update" ON public.battery_tracking;
CREATE POLICY "authenticated_update" ON public.battery_tracking FOR UPDATE USING (auth.uid() IS NOT NULL);

-- ------------------------------------------------------------
-- STEP 3: users. Row-level: own row, or Admin sees all.
-- Column-level: authenticated users can only ever update
-- is_logged_in/last_ping on their own row (the heartbeat) — never
-- role, password, name, etc. This is the fix for the privilege-
-- escalation hole (a raw REST PATCH could otherwise set role='Admin'
-- on your own row under a naive row-only policy).
-- ------------------------------------------------------------
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "own_row_or_admin_select" ON public.users;
CREATE POLICY "own_row_or_admin_select" ON public.users
  FOR SELECT USING (
    auth_id = auth.uid() OR current_user_role() = 'Admin'
  );

DROP POLICY IF EXISTS "own_row_update" ON public.users;
CREATE POLICY "own_row_update" ON public.users
  FOR UPDATE USING (auth_id = auth.uid());

REVOKE UPDATE ON public.users FROM authenticated;
GRANT UPDATE (is_logged_in, last_ping) ON public.users TO authenticated;

-- ------------------------------------------------------------
-- STEP 4: audit_logs. Own rows, or Admin sees all. INSERT is
-- scoped so a client can't spoof user_id as someone else — the
-- checked value is looked up server-side from the caller's own
-- session, not trusted from the insert payload.
-- ------------------------------------------------------------
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "own_rows_or_admin_select" ON public.audit_logs;
CREATE POLICY "own_rows_or_admin_select" ON public.audit_logs
  FOR SELECT USING (
    user_id = (SELECT id FROM public.users WHERE auth_id = auth.uid())
    OR current_user_role() = 'Admin'
  );

DROP POLICY IF EXISTS "own_user_id_insert" ON public.audit_logs;
CREATE POLICY "own_user_id_insert" ON public.audit_logs
  FOR INSERT WITH CHECK (
    user_id = (SELECT id FROM public.users WHERE auth_id = auth.uid())
  );

-- ------------------------------------------------------------
-- STEP 5: Revoke (not drop) the old, unsafe RPCs. Revoking keeps
-- a fast rollback path (re-GRANT) if Stage 3 turns out to still be
-- in use somewhere unexpected; dropping them and the old `password`
-- column is a later cleanup migration after a bake period.
-- ------------------------------------------------------------
REVOKE EXECUTE ON FUNCTION public.verify_password(TEXT, TEXT) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.create_dynamic_table(TEXT) FROM anon, authenticated;

-- ============================================================
-- VERIFICATION — run after this script:
--   1. Full login + navigation smoke test with a migrated user.
--   2. Confirm a direct REST call attempting to PATCH `role` on a
--      `users` row now fails (proves the column-level GRANT works):
--      curl -X PATCH '<SUPABASE_URL>/rest/v1/users?id=eq.<some_id>' \
--        -H "apikey: <anon_key>" -H "Authorization: Bearer <user_jwt>" \
--        -H "Content-Type: application/json" -d '{"role":"Admin"}'
--      Expect a 403/permission-denied response.
--   3. Confirm verify_password / create_dynamic_table now fail with
--      a permission-denied error when called via supabase.rpc().
-- ============================================================
