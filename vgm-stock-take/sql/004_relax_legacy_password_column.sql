-- ============================================================
-- VGM CKD Stock Take — relax legacy password column
-- ============================================================
-- public.users.password is the old bcrypt column from before the
-- Supabase Auth migration, intentionally kept (not dropped) as a
-- rollback path during the bake period. It's no longer read by the
-- app - real auth now goes through Supabase Auth entirely. But it's
-- still NOT NULL, so inserting a new operator via the Admin panel
-- (api/admin/create-user.ts) fails: a brand-new user never had an
-- old password to migrate, so there's nothing to put there.
-- ============================================================

ALTER TABLE public.users
  ALTER COLUMN password DROP NOT NULL;
