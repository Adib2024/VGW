-- ============================================================
-- VGM CKD Stock Take — Password Security Migration
-- ============================================================
-- This migration adds password hashing using pgcrypto.
-- Run this SQL once in Supabase SQL Editor after enabling pgcrypto.
--
-- Step 1: Enable pgcrypto extension
-- Step 2: Hash all existing plaintext passwords
-- Step 3: Create verify_password RPC function
-- ============================================================

-- STEP 1: Enable pgcrypto (may already be enabled)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- STEP 2: Hash all existing plaintext passwords
-- This updates every user's password to a bcrypt hash.
-- Only run ONCE. After this, all passwords will be hashed.
-- Safety check: Only hash if the password isn't already a bcrypt hash
-- (covers all bcrypt prefixes: $2a$, $2b$, $2x$, $2y$)
UPDATE users
SET password = crypt(password, gen_salt('bf', 10))
WHERE password IS NOT NULL
  AND password != ''
  AND password NOT LIKE '$2%';

-- STEP 3: Create secure password verification RPC
-- The frontend calls: supabase.rpc('verify_password', { p_user_id: '...', p_password: '...' })
-- Returns TRUE if valid, FALSE if invalid.
CREATE OR REPLACE FUNCTION verify_password(p_user_id TEXT, p_password TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  stored_hash TEXT;
BEGIN
  SELECT password INTO stored_hash
  FROM users
  WHERE id = p_user_id;

  IF stored_hash IS NULL THEN
    RETURN FALSE;
  END IF;

  -- Compare the provided password against the stored bcrypt hash
  RETURN (stored_hash = crypt(p_password, stored_hash));
END;
$$;

-- Grant execute permission to the anon role (used by Supabase client)
GRANT EXECUTE ON FUNCTION verify_password(TEXT, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION verify_password(TEXT, TEXT) TO authenticated;
