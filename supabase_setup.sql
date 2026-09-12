-- =============================================================
-- 3A12 REUNION SYSTEM — Contribution Payments Table
-- Run this once in Supabase → SQL Editor → Run
-- =============================================================

-- Individual payment installments (one row per payment received)
CREATE TABLE IF NOT EXISTS contribution_payments (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  classmate_id          uuid NOT NULL REFERENCES classmates(id) ON DELETE CASCADE,
  amount                numeric(10, 2) NOT NULL CHECK (amount > 0),
  payment_method        text NOT NULL DEFAULT 'MTN MOBILE MONEY',
  transaction_reference text,
  payment_date          date NOT NULL DEFAULT CURRENT_DATE,
  recorded_by           text,
  notes                 text,
  created_at            timestamptz NOT NULL DEFAULT now()
);

-- Index for fast per-classmate lookups
CREATE INDEX IF NOT EXISTS idx_contribution_payments_classmate
  ON contribution_payments (classmate_id);

-- =============================================================
-- Make sure the contributions table has the right columns.
-- These ALTER statements are safe to run even if columns exist
-- (they will error silently if the column is already there).
-- =============================================================

ALTER TABLE contributions
  ADD COLUMN IF NOT EXISTS expected_amount  numeric(10, 2) NOT NULL DEFAULT 500.00,
  ADD COLUMN IF NOT EXISTS amount_paid      numeric(10, 2) NOT NULL DEFAULT 0.00,
  ADD COLUMN IF NOT EXISTS payment_status   text          NOT NULL DEFAULT 'UNPAID',
  ADD COLUMN IF NOT EXISTS updated_at       timestamptz   NOT NULL DEFAULT now();

-- =============================================================
-- Helper function — recalculates amount_paid and payment_status
-- on the contributions row whenever a payment is inserted,
-- updated or deleted.
-- =============================================================

CREATE OR REPLACE FUNCTION sync_contribution_totals()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_classmate_id  uuid;
  v_total_paid    numeric(10, 2);
  v_expected      numeric(10, 2);
  v_status        text;
BEGIN
  -- Determine which classmate_id to recalculate for
  IF TG_OP = 'DELETE' THEN
    v_classmate_id := OLD.classmate_id;
  ELSE
    v_classmate_id := NEW.classmate_id;
  END IF;

  -- Sum all payments for this classmate
  SELECT COALESCE(SUM(amount), 0)
    INTO v_total_paid
    FROM contribution_payments
   WHERE classmate_id = v_classmate_id;

  -- Get their expected amount (default 500 if no record yet)
  SELECT COALESCE(expected_amount, 500)
    INTO v_expected
    FROM contributions
   WHERE classmate_id = v_classmate_id;

  -- Derive status
  IF v_total_paid <= 0 THEN
    v_status := 'UNPAID';
  ELSIF v_total_paid >= v_expected THEN
    v_status := 'PAID';
  ELSE
    v_status := 'PARTIAL';
  END IF;

  -- Upsert the contributions summary row
  INSERT INTO contributions (classmate_id, expected_amount, amount_paid, payment_status, updated_at)
    VALUES (v_classmate_id, v_expected, v_total_paid, v_status, now())
  ON CONFLICT (classmate_id)
    DO UPDATE SET
      amount_paid    = EXCLUDED.amount_paid,
      payment_status = EXCLUDED.payment_status,
      updated_at     = now();

  RETURN NULL;
END;
$$;

-- Attach the trigger to contribution_payments
DROP TRIGGER IF EXISTS trg_sync_contribution_totals ON contribution_payments;

CREATE TRIGGER trg_sync_contribution_totals
  AFTER INSERT OR UPDATE OR DELETE ON contribution_payments
  FOR EACH ROW EXECUTE FUNCTION sync_contribution_totals();

-- =============================================================
-- Enable Row Level Security (read/write for authenticated users)
-- =============================================================

ALTER TABLE contribution_payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can manage payments" ON contribution_payments;

CREATE POLICY "Authenticated users can manage payments"
  ON contribution_payments
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);
