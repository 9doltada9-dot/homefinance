-- HomeFinance: Auth migration (v3.2.0)
-- Prerequisites: supabase_migration_v3.sql must already be applied
-- Run this in Supabase SQL Editor

-- ─────────────────────────────────────────────────────────────
-- 1. PROFILES TABLE
--    One row per auth user; stores display name + role
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS profiles (
  id         uuid        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name       text        NOT NULL DEFAULT '',
  role       text        NOT NULL DEFAULT 'user'
                         CHECK (role IN ('user','admin')),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Own profile: read + write
DO $$ BEGIN
  CREATE POLICY "profiles: own select" ON profiles
    FOR SELECT USING (auth.uid() = id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "profiles: own insert" ON profiles
    FOR INSERT WITH CHECK (auth.uid() = id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "profiles: own update" ON profiles
    FOR UPDATE USING (auth.uid() = id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Admin: read all profiles
DO $$ BEGIN
  CREATE POLICY "profiles: admin select all" ON profiles
    FOR SELECT USING (
      EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Admin: update any profile (e.g. change role)
DO $$ BEGIN
  CREATE POLICY "profiles: admin update all" ON profiles
    FOR UPDATE USING (
      EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─────────────────────────────────────────────────────────────
-- 2. ADD user_id TO TRANSACTIONS
-- ─────────────────────────────────────────────────────────────
ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id);

CREATE INDEX IF NOT EXISTS idx_tx_user_id ON transactions(user_id);

-- ─────────────────────────────────────────────────────────────
-- 3. UPDATE TRANSACTION RLS
--    Replace old open policies with user-scoped ones
--    NOTE: if you already have policies named below, the DO block
--    will silently skip them (duplicate_object). Drop old ones first
--    if you want to replace them:
--      DROP POLICY IF EXISTS "Enable read access for all users" ON transactions;
-- ─────────────────────────────────────────────────────────────

-- Regular user: sees own rows + legacy rows (user_id IS NULL)
DO $$ BEGIN
  CREATE POLICY "tx: user own select" ON transactions
    FOR SELECT USING (
      auth.uid() = user_id
      OR user_id IS NULL
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Admin: sees ALL rows
DO $$ BEGIN
  CREATE POLICY "tx: admin select all" ON transactions
    FOR SELECT USING (
      EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Insert: user must set their own user_id (or NULL for legacy migration)
DO $$ BEGIN
  CREATE POLICY "tx: user own insert" ON transactions
    FOR INSERT WITH CHECK (
      auth.uid() = user_id OR user_id IS NULL
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Update: own rows only
DO $$ BEGIN
  CREATE POLICY "tx: user own update" ON transactions
    FOR UPDATE USING (
      auth.uid() = user_id OR user_id IS NULL
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Delete: own rows only
DO $$ BEGIN
  CREATE POLICY "tx: user own delete" ON transactions
    FOR DELETE USING (
      auth.uid() = user_id OR user_id IS NULL
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Admin: full write access to all rows
DO $$ BEGIN
  CREATE POLICY "tx: admin all" ON transactions
    FOR ALL USING (
      EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─────────────────────────────────────────────────────────────
-- 4. FIRST ADMIN SETUP
--    After creating your first Supabase Auth user, promote them:
--
--    INSERT INTO profiles (id, name, role)
--    VALUES ('<your-user-uuid>', 'Admin', 'admin')
--    ON CONFLICT (id) DO UPDATE SET role = 'admin';
--
-- ─────────────────────────────────────────────────────────────
