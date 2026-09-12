-- =============================================================
-- 3A12 REUNION SYSTEM — Check-In & Memories Setup
-- Run once in Supabase → SQL Editor → Run
-- =============================================================

-- ── 1. CHECK-IN COLUMNS ───────────────────────────────────────
-- Add check-in tracking directly on the classmates table

ALTER TABLE classmates
  ADD COLUMN IF NOT EXISTS checked_in      boolean     NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS checked_in_at   timestamptz,
  ADD COLUMN IF NOT EXISTS checked_in_by   text;        -- admin email who checked them in

-- Index for fast check-in status queries
CREATE INDEX IF NOT EXISTS idx_classmates_checked_in
  ON classmates (checked_in);

-- ── 2. MEMORIES WALL TABLE ────────────────────────────────────
-- Stores admin-approved memories for public display.
-- Source is the favourite_memory field on classmates.

CREATE TABLE IF NOT EXISTS memories_wall (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  classmate_id    uuid NOT NULL REFERENCES classmates(id) ON DELETE CASCADE,
  memory_text     text NOT NULL,
  display_name    text NOT NULL,   -- how the name appears publicly (e.g. "Kwame A." for privacy)
  approved_by     text,            -- admin email who approved it
  approved_at     timestamptz NOT NULL DEFAULT now(),
  is_anonymous    boolean NOT NULL DEFAULT false,

  CONSTRAINT uq_memory_per_classmate UNIQUE (classmate_id)
);

CREATE INDEX IF NOT EXISTS idx_memories_wall_approved_at
  ON memories_wall (approved_at DESC);

-- ── 3. ROW LEVEL SECURITY ─────────────────────────────────────

-- memories_wall: public can read approved memories
ALTER TABLE memories_wall ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read memories wall" ON memories_wall;
CREATE POLICY "Public read memories wall"
  ON memories_wall FOR SELECT USING (true);

DROP POLICY IF EXISTS "Auth manage memories wall" ON memories_wall;
CREATE POLICY "Auth manage memories wall"
  ON memories_wall FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- classmates table already has RLS — the new columns inherit existing policies.

-- =============================================================
-- DONE.
-- New columns on classmates: checked_in, checked_in_at, checked_in_by
-- New table: memories_wall
-- =============================================================
