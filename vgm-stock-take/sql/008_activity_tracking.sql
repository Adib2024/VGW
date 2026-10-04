-- ============================================================
-- VGM CKD Stock Take — who changed each part, and when
-- ============================================================
-- Zone tables had no timestamp or author per row, so the User Progress
-- "Recent activity" report could only sort by status. This adds:
--
--   updated_at  TIMESTAMPTZ - time of the last count/verify/remark
--   updated_by  TEXT        - display name of whoever made it
--
-- Both are set server-side by a trigger on every UPDATE: updated_by comes
-- from the caller's own users row (never trusted from the client), and
-- updated_at is now() - except that a client may send an earlier time for a
-- save that was queued while offline and synced later (see
-- src/lib/offlineQueue.ts), so the report shows when the count actually
-- happened. Future timestamps are never accepted.
--
-- Rows inserted by an upload keep NULLs ("never touched").
--
-- Safe to re-run. Run once in the Supabase SQL editor.
-- ============================================================

CREATE OR REPLACE FUNCTION public.zone_row_touch()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.updated_at IS NULL
     OR NEW.updated_at IS NOT DISTINCT FROM OLD.updated_at
     OR NEW.updated_at > now() THEN
    NEW.updated_at := now();
  END IF;

  NEW.updated_by := COALESCE(
    (SELECT name FROM public.users WHERE auth_id = auth.uid()),
    NEW.updated_by
  );

  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.zone_row_touch() FROM PUBLIC;

-- Adds the columns + trigger to one zone table (idempotent).
CREATE OR REPLACE FUNCTION public.zone_table_add_tracking(p_table_name TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ', p_table_name);
  EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS updated_by TEXT', p_table_name);
  EXECUTE format('DROP TRIGGER IF EXISTS zone_row_touch ON public.%I', p_table_name);
  EXECUTE format(
    'CREATE TRIGGER zone_row_touch BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.zone_row_touch()',
    p_table_name
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.zone_table_add_tracking(TEXT) FROM PUBLIC;

-- 1. Existing zone tables (skips any that don't exist right now).
DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['b17', 'b22', 'loma', 'b22_seq', 'check_part'] LOOP
    IF to_regclass('public.' || t) IS NOT NULL THEN
      PERFORM public.zone_table_add_tracking(t);
    END IF;
  END LOOP;
END;
$$;

-- 2. Zone tables created by future uploads get the same tracking.
--    Same as sql/006_active_user_rls.sql's version plus the last line.
CREATE OR REPLACE FUNCTION public.admin_create_zone_table(p_table_name TEXT, p_columns TEXT[])
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  col TEXT;
  col_defs TEXT := '';
  reserved TEXT[] := ARRAY['users', 'audit_logs', 'battery_tracking', 'battery_scan_log'];
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
    IF col IN ('id', 'batch_id', 'status', 'updated_at', 'updated_by') THEN
      CONTINUE; -- already defined as fixed columns, skip duplicates
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

  PERFORM public.zone_table_add_tracking(p_table_name);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_create_zone_table(TEXT, TEXT[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_create_zone_table(TEXT, TEXT[]) TO authenticated;

-- ============================================================
-- VERIFICATION — each existing zone table should list both columns:
-- ============================================================
-- SELECT table_name, column_name FROM information_schema.columns
-- WHERE table_schema = 'public' AND column_name IN ('updated_at', 'updated_by')
-- ORDER BY table_name, column_name;
