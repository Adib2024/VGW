-- ============================================================
-- VGM CKD Stock Take — Stage 1: Auth migration (additive, safe)
-- ============================================================
-- Run this once in the Supabase SQL Editor. It only ADDS columns
-- and functions — nothing here breaks the current app, and the
-- old verify_password / create_dynamic_table RPCs are left alone.
--
-- After this: run the pre-flight check at the bottom, then run
-- scripts/migrate-users-to-auth.mjs (Stage 2), then deploy the
-- new app code (Stage 3). Do NOT run sql/002_rls_lockdown.sql
-- until Stage 3 is confirmed fully live — see that file's header.
-- ============================================================

-- STEP 1: Link existing profile rows to real Supabase Auth users.
-- id/name/role/password stay exactly as they are today.
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS auth_id UUID UNIQUE REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS email TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN NOT NULL DEFAULT true;

-- STEP 2: Role lookup helper, used by RLS policies (Stage 4) and by
-- the RPCs below. SECURITY DEFINER so it can read `users` regardless
-- of the caller's own row-level permissions; search_path is pinned
-- to prevent search_path-hijacking of a SECURITY DEFINER function.
CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS TEXT
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT role FROM public.users WHERE auth_id = auth.uid();
$$;

GRANT EXECUTE ON FUNCTION public.current_user_role() TO authenticated;

-- STEP 3: Lets a logged-in user clear their own must_change_password
-- flag after setting a real password. Deliberately narrow — it can
-- only ever touch the caller's own row, and only that one column.
CREATE OR REPLACE FUNCTION public.clear_must_change_password()
RETURNS VOID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  UPDATE public.users SET must_change_password = false WHERE auth_id = auth.uid();
$$;

GRANT EXECUTE ON FUNCTION public.clear_must_change_password() TO authenticated;

-- STEP 4: Replacement for create_dynamic_table. Unlike the old RPC,
-- this never accepts raw SQL from the client — only a table name and
-- a list of bare column names, both re-validated here (never trust
-- what the client already sanitized). The role check is the actual
-- security boundary; RLS policies applied are fixed, not client-supplied.
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
  EXECUTE format('CREATE POLICY "authenticated_select" ON %I FOR SELECT USING (auth.uid() IS NOT NULL)', p_table_name);

  EXECUTE format('DROP POLICY IF EXISTS "authenticated_insert" ON %I', p_table_name);
  EXECUTE format('CREATE POLICY "authenticated_insert" ON %I FOR INSERT WITH CHECK (auth.uid() IS NOT NULL)', p_table_name);

  EXECUTE format('DROP POLICY IF EXISTS "authenticated_update" ON %I', p_table_name);
  EXECUTE format('CREATE POLICY "authenticated_update" ON %I FOR UPDATE USING (auth.uid() IS NOT NULL)', p_table_name);
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_create_zone_table(TEXT, TEXT[]) TO authenticated;

-- STEP 5: Replacement for the DROP-TABLE half of create_dynamic_table.
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

-- ============================================================
-- PRE-FLIGHT CHECK — run this manually before Stage 2.
-- Must return zero rows. Case-insensitive username collisions
-- would break deterministic synthetic-email derivation
-- (lower(id) + '@vgm-ckd.internal') used by the migration script.
-- ============================================================
-- SELECT lower(id), count(*) FROM public.users GROUP BY lower(id) HAVING count(*) > 1;
