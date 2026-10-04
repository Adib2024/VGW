-- ============================================================
-- VGM CKD — battery scan history
-- ============================================================
-- battery_tracking holds ONE row per battery serial, and every re-scan
-- overwrites it (status, location, scanned_by, created_at), so where a
-- battery was before - and who moved it - was lost. battery_scan_log keeps
-- every scan as its own append-only row; battery_tracking stays as the
-- "current state" table the app already reads.
--
-- Append-only: authenticated users may INSERT and SELECT, never UPDATE or
-- DELETE (no policies for those + explicit REVOKE, same approach as
-- sql/007_audit_logs_revoke.sql). scanned_by is filled server-side from the
-- caller's own users row, so it can't be spoofed by the client.
--
-- Safe to re-run. Run once in the Supabase SQL editor.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.battery_scan_log (
  id BIGSERIAL PRIMARY KEY,
  battery_serial_number TEXT NOT NULL,
  status TEXT,
  location_id TEXT,
  part_number TEXT,
  scanned_by TEXT,
  scanned_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS battery_scan_log_serial_idx
  ON public.battery_scan_log (battery_serial_number, scanned_at DESC);
CREATE INDEX IF NOT EXISTS battery_scan_log_time_idx
  ON public.battery_scan_log (scanned_at DESC);

CREATE OR REPLACE FUNCTION public.battery_scan_log_stamp()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  NEW.scanned_by := COALESCE(
    (SELECT id FROM public.users WHERE auth_id = auth.uid()),
    NEW.scanned_by
  );
  IF NEW.scanned_at IS NULL OR NEW.scanned_at > now() THEN
    NEW.scanned_at := now();
  END IF;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.battery_scan_log_stamp() FROM PUBLIC;

DROP TRIGGER IF EXISTS battery_scan_log_stamp ON public.battery_scan_log;
CREATE TRIGGER battery_scan_log_stamp
  BEFORE INSERT ON public.battery_scan_log
  FOR EACH ROW EXECUTE FUNCTION public.battery_scan_log_stamp();

ALTER TABLE public.battery_scan_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "authenticated_select" ON public.battery_scan_log;
CREATE POLICY "authenticated_select" ON public.battery_scan_log
  FOR SELECT USING (current_user_active());

DROP POLICY IF EXISTS "authenticated_insert" ON public.battery_scan_log;
CREATE POLICY "authenticated_insert" ON public.battery_scan_log
  FOR INSERT WITH CHECK (current_user_active());

REVOKE UPDATE, DELETE ON public.battery_scan_log FROM authenticated, anon;

-- ============================================================
-- VERIFICATION
-- ============================================================
-- SELECT policyname, cmd FROM pg_policies WHERE tablename = 'battery_scan_log';
--   -> authenticated_select (SELECT), authenticated_insert (INSERT) only
