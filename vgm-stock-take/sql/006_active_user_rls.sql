-- ============================================================
-- VGM CKD Stock Take — RLS checks live is_active, not just "authenticated"
-- ============================================================
-- A Supabase Auth JWT stays valid until its own expiry even after an
-- account is deactivated (api/admin/set-active.ts's ban_duration blocks new
-- sign-ins/refreshes, but PostgREST verifies an already-issued token
-- locally - it doesn't round-trip to GoTrue per request). Every zone-table
-- policy today is just `USING (auth.uid() IS NOT NULL)` - any authenticated
-- session, active or not - so a just-deactivated user (e.g. a terminated
-- employee) can keep writing inventory data for up to the remaining life of
-- their token. This closes that window at the RLS layer itself, so it no
-- longer depends on the JWT expiry setting alone.
-- ============================================================

CREATE OR REPLACE FUNCTION public.current_user_active()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT COALESCE((SELECT is_active FROM public.users WHERE auth_id = auth.uid()), false);
$$;

REVOKE EXECUTE ON FUNCTION public.current_user_active() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_user_active() TO authenticated;

DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['b17', 'b22', 'loma', 'b22_seq', 'check_part', 'battery_tracking'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS "authenticated_select" ON public.%I', t);
    EXECUTE format('CREATE POLICY "authenticated_select" ON public.%I FOR SELECT USING (current_user_active())', t);

    EXECUTE format('DROP POLICY IF EXISTS "authenticated_insert" ON public.%I', t);
    EXECUTE format('CREATE POLICY "authenticated_insert" ON public.%I FOR INSERT WITH CHECK (current_user_active())', t);

    EXECUTE format('DROP POLICY IF EXISTS "authenticated_update" ON public.%I', t);
    EXECUTE format('CREATE POLICY "authenticated_update" ON public.%I FOR UPDATE USING (current_user_active())', t);
  END LOOP;
END;
$$;

-- ============================================================
-- Bake the same is_active check into admin_create_zone_table, so every
-- future zone table created via CSV upload gets it automatically.
--
-- NOTE on the reserved-name list: b17/b22/loma/b22_seq/check_part are
-- deliberately NOT added here, despite an earlier audit suggesting it.
-- Checked against actual usage first: Settings.tsx's "Unlock & Clear Zone"
-- button calls admin_drop_zone_table(selectedZone), and every CSV upload
-- calls admin_create_zone_table(targetTable) - both with one of these five
-- names as their normal, everyday target, not an edge case. Reserving them
-- would break both core admin features. The reserved list stays scoped to
-- tables that should never be touched by this RPC at all.
-- ============================================================

CREATE OR REPLACE FUNCTION public.admin_create_zone_table(p_table_name TEXT, p_columns TEXT[])
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  col TEXT;
  col_defs TEXT := '';
  reserved TEXT[] := ARRAY['users', 'audit_logs', 'battery_tracking'];
BEGIN
  IF current_user_role() IS DISTINCT FROM 'Admin' THEN
    RAISE EXCEPTION 'Only Admins can create zone tables';
  END IF;

  IF p_table_name !~ '^[a-z][a-z0-9_]{0,62}$' THEN
    RAISE EXCEPTION 'Invalid table name: %', p_table_name;
  END IF;

  IF p_table_name = ANY(reserved) OR p_table_name LIKE 'pg\_%' OR p_table_name LIKE 'auth%' THEN
    RAISE EXCEPTION 'Table name % is reserved', p_table_name;
  END IF;

  FOREACH col IN ARRAY p_columns LOOP
    IF col !~ '^[a-z][a-z0-9_]{0,62}$' THEN
      RAISE EXCEPTION 'Invalid column name: %', col;
    END IF;
    IF col IN ('id', 'batch_id', 'status') THEN
      CONTINUE; -- already defined as fixed columns below, skip duplicates
    END IF;
    col_defs := col_defs || format(', %I TEXT', col);
  END LOOP;

  EXECUTE format(
    'CREATE TABLE IF NOT EXISTS %I (
       id BIGSERIAL PRIMARY KEY,
       batch_id TEXT,
       status TEXT DEFAULT ''Not Counted''%s
     )',
    p_table_name, col_defs
  );

  EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', p_table_name);

  EXECUTE format('DROP POLICY IF EXISTS "authenticated_select" ON %I', p_table_name);
  EXECUTE format('CREATE POLICY "authenticated_select" ON %I FOR SELECT USING (current_user_active())', p_table_name);

  EXECUTE format('DROP POLICY IF EXISTS "authenticated_insert" ON %I', p_table_name);
  EXECUTE format('CREATE POLICY "authenticated_insert" ON %I FOR INSERT WITH CHECK (current_user_active())', p_table_name);

  EXECUTE format('DROP POLICY IF EXISTS "authenticated_update" ON %I', p_table_name);
  EXECUTE format('CREATE POLICY "authenticated_update" ON %I FOR UPDATE USING (current_user_active())', p_table_name);
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_create_zone_table(TEXT, TEXT[]) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_drop_zone_table(p_table_name TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  reserved TEXT[] := ARRAY['users', 'audit_logs', 'battery_tracking'];
BEGIN
  IF current_user_role() IS DISTINCT FROM 'Admin' THEN
    RAISE EXCEPTION 'Only Admins can drop zone tables';
  END IF;

  IF p_table_name !~ '^[a-z][a-z0-9_]{0,62}$' THEN
    RAISE EXCEPTION 'Invalid table name: %', p_table_name;
  END IF;

  IF p_table_name = ANY(reserved) OR p_table_name LIKE 'pg\_%' OR p_table_name LIKE 'auth%' THEN
    RAISE EXCEPTION 'Table name % is reserved', p_table_name;
  END IF;

  EXECUTE format('DROP TABLE IF EXISTS %I', p_table_name);
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_drop_zone_table(TEXT) TO authenticated;
