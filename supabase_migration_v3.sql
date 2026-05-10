-- ============================================================
--  HomeFinance · Supabase Migration · v3.0.0
--  รันใน SQL Editor ของ Supabase ก่อน deploy
--  (ทุกคำสั่ง idempotent — รันซ้ำได้ปลอดภัย)
--
--  หมายเหตุ: PostgreSQL ไม่รองรับ CREATE POLICY IF NOT EXISTS
--  ใช้ DO $$ BEGIN...EXCEPTION WHEN duplicate_object แทน
-- ============================================================

-- ─── 1. เพิ่ม column ใหม่ใน transactions ─────────────────────

ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS billing_month       text,
  ADD COLUMN IF NOT EXISTS cycle_id            text,
  ADD COLUMN IF NOT EXISTS account_id          text,
  ADD COLUMN IF NOT EXISTS transfer_direction  text,
  ADD COLUMN IF NOT EXISTS transfer_pair_id    text,
  ADD COLUMN IF NOT EXISTS _recurring_id       text,
  ADD COLUMN IF NOT EXISTS _salary_cycle       boolean DEFAULT false;

-- เพิ่ม index เพื่อเร่ง query
CREATE INDEX IF NOT EXISTS idx_tx_cycle_id      ON transactions(cycle_id);
CREATE INDEX IF NOT EXISTS idx_tx_billing_month ON transactions(billing_month);
CREATE INDEX IF NOT EXISTS idx_tx_account_id    ON transactions(account_id);

-- ─── 2. ตาราง accounts ───────────────────────────────────────

CREATE TABLE IF NOT EXISTS accounts (
  id              text PRIMARY KEY,
  name            text NOT NULL,
  type            text NOT NULL DEFAULT 'bank',
  color           text DEFAULT '#1a4fa0',
  initial_balance numeric DEFAULT 0,
  is_active       boolean DEFAULT true,
  created_at      timestamptz DEFAULT now()
);

ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "accounts public read"  ON accounts FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "accounts public write" ON accounts FOR ALL    USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- seed บัญชีหลักถ้ายังไม่มี
INSERT INTO accounts (id, name, type, color, initial_balance, is_active)
VALUES ('acct-default', 'บัญชีหลัก', 'bank', '#1a4fa0', 0, true)
ON CONFLICT (id) DO NOTHING;

-- ─── 3. ตาราง savings_goals ──────────────────────────────────

CREATE TABLE IF NOT EXISTS savings_goals (
  id              text PRIMARY KEY,
  name            text NOT NULL,
  target_amount   numeric NOT NULL DEFAULT 0,
  current_amount  numeric NOT NULL DEFAULT 0,
  deadline        text,
  account_id      text REFERENCES accounts(id) ON DELETE SET NULL,
  note            text,
  is_completed    boolean DEFAULT false,
  created_at      timestamptz DEFAULT now()
);

ALTER TABLE savings_goals ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "savings_goals public read"  ON savings_goals FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "savings_goals public write" ON savings_goals FOR ALL    USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─── 4. ตาราง cycles ─────────────────────────────────────────

CREATE TABLE IF NOT EXISTS cycles (
  id         text PRIMARY KEY,
  start      text NOT NULL,
  "end"      text NOT NULL,
  label      text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE cycles ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "cycles public read"  ON cycles FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "cycles public write" ON cycles FOR ALL    USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─── 5. RLS policy ของ transactions (ถ้ายังไม่มี) ────────────

DO $$ BEGIN
  CREATE POLICY "public read"  ON transactions FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "public write" ON transactions FOR ALL    USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─── 6. backfill cycle_id + billing_month สำหรับข้อมูลเก่า ──

-- billing_month = YYYY-MM ของ transaction_date
UPDATE transactions
  SET billing_month = to_char(date::date, 'YYYY-MM')
  WHERE billing_month IS NULL AND date IS NOT NULL;

-- cycle_id: วันที่ >= 25 → รอบเดือนนั้น, < 25 → รอบเดือนก่อน
UPDATE transactions
  SET cycle_id = CASE
    WHEN EXTRACT(DAY FROM date::date) >= 25
    THEN 'cycle-' || to_char(date::date, 'YYYY-MM')
    ELSE 'cycle-' || to_char(date::date - interval '1 month', 'YYYY-MM')
  END
  WHERE cycle_id IS NULL AND date IS NOT NULL;

-- ─── เสร็จแล้ว ✓ ─────────────────────────────────────────────
-- 1. transactions: 7 columns ใหม่ + index + backfill
-- 2. accounts / savings_goals / cycles: สร้างพร้อม RLS
-- 3. รันซ้ำได้ปลอดภัย (idempotent ทุกคำสั่ง)
