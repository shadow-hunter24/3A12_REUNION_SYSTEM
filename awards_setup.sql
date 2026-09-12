-- =============================================================
-- 3A12 REUNION SYSTEM — Awards System Setup
-- Run this once in Supabase → SQL Editor → Run
-- =============================================================

-- ── 1. AWARD CATEGORIES ──────────────────────────────────────
-- Add icon column if it doesn't exist yet

ALTER TABLE award_categories
  ADD COLUMN IF NOT EXISTS icon text DEFAULT '🏆';

-- ── 2. AWARD NOMINATIONS ─────────────────────────────────────
-- One nomination per nominator per category

CREATE TABLE IF NOT EXISTS award_nominations (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id   uuid NOT NULL REFERENCES award_categories(id) ON DELETE CASCADE,
  nominator_id  uuid NOT NULL REFERENCES classmates(id) ON DELETE CASCADE,
  nominee_id    uuid NOT NULL REFERENCES classmates(id) ON DELETE CASCADE,
  reason        text,
  created_at    timestamptz NOT NULL DEFAULT now(),

  -- A classmate can only nominate once per category
  CONSTRAINT uq_nomination_per_category
    UNIQUE (category_id, nominator_id)
);

CREATE INDEX IF NOT EXISTS idx_nominations_category
  ON award_nominations (category_id);

CREATE INDEX IF NOT EXISTS idx_nominations_nominee
  ON award_nominations (nominee_id);

-- ── 3. AWARD FINALISTS ───────────────────────────────────────
-- Admin explicitly approves who goes to the voting stage

CREATE TABLE IF NOT EXISTS award_finalists (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id uuid NOT NULL REFERENCES award_categories(id) ON DELETE CASCADE,
  classmate_id uuid NOT NULL REFERENCES classmates(id) ON DELETE CASCADE,
  added_by    text,
  created_at  timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT uq_finalist_per_category
    UNIQUE (category_id, classmate_id)
);

CREATE INDEX IF NOT EXISTS idx_finalists_category
  ON award_finalists (category_id);

-- ── 4. AWARD VOTES ───────────────────────────────────────────
-- One vote per voter per category, only for approved finalists

CREATE TABLE IF NOT EXISTS award_votes (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id uuid NOT NULL REFERENCES award_categories(id) ON DELETE CASCADE,
  voter_id    uuid NOT NULL REFERENCES classmates(id) ON DELETE CASCADE,
  nominee_id  uuid NOT NULL REFERENCES classmates(id) ON DELETE CASCADE,
  created_at  timestamptz NOT NULL DEFAULT now(),

  -- Voter can only vote once per category
  CONSTRAINT uq_vote_per_category
    UNIQUE (category_id, voter_id)
);

CREATE INDEX IF NOT EXISTS idx_votes_category
  ON award_votes (category_id);

-- ── 5. ROW LEVEL SECURITY ─────────────────────────────────────

ALTER TABLE award_categories   ENABLE ROW LEVEL SECURITY;
ALTER TABLE award_nominations  ENABLE ROW LEVEL SECURITY;
ALTER TABLE award_finalists    ENABLE ROW LEVEL SECURITY;
ALTER TABLE award_votes        ENABLE ROW LEVEL SECURITY;

-- Public read on categories (everyone sees the award list)
DROP POLICY IF EXISTS "Public read categories" ON award_categories;
CREATE POLICY "Public read categories"
  ON award_categories FOR SELECT USING (true);

-- Authenticated write on categories (admin only in practice)
DROP POLICY IF EXISTS "Auth manage categories" ON award_categories;
CREATE POLICY "Auth manage categories"
  ON award_categories FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Nominations: public insert via RPC; public read
DROP POLICY IF EXISTS "Public read nominations" ON award_nominations;
CREATE POLICY "Public read nominations"
  ON award_nominations FOR SELECT USING (true);

DROP POLICY IF EXISTS "Auth manage nominations" ON award_nominations;
CREATE POLICY "Auth manage nominations"
  ON award_nominations FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Finalists: public read; authenticated write (admin)
DROP POLICY IF EXISTS "Public read finalists" ON award_finalists;
CREATE POLICY "Public read finalists"
  ON award_finalists FOR SELECT USING (true);

DROP POLICY IF EXISTS "Auth manage finalists" ON award_finalists;
CREATE POLICY "Auth manage finalists"
  ON award_finalists FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Votes: public insert via RPC; authenticated read (admin)
DROP POLICY IF EXISTS "Auth read votes" ON award_votes;
CREATE POLICY "Auth read votes"
  ON award_votes FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Auth manage votes" ON award_votes;
CREATE POLICY "Auth manage votes"
  ON award_votes FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ── 6. SAFE RPC: verify_reunion_member ───────────────────────
-- Returns only id, full_name, class_id — no private fields
-- DROP first in case the old version has a different return type

DROP FUNCTION IF EXISTS verify_reunion_member(text, text);

CREATE OR REPLACE FUNCTION verify_reunion_member(
  p_class_id text,
  p_phone    text
)
RETURNS TABLE (
  id        uuid,
  full_name text,
  class_id  text
)
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY
    SELECT c.id, c.full_name, c.class_id
      FROM classmates c
     WHERE c.class_id = TRIM(p_class_id)
       AND REGEXP_REPLACE(c.phone, '[^0-9]', '', 'g')
         = REGEXP_REPLACE(TRIM(p_phone), '[^0-9]', '', 'g')
     LIMIT 1;
END;
$$;

-- ── 7. SAFE RPC: get_classmates_for_nomination ───────────────
-- Returns only id, full_name, class_id — no emails, phones, etc.
-- Excludes the nominator so you cannot nominate yourself.

CREATE OR REPLACE FUNCTION get_classmates_for_nomination(
  p_nominator_id uuid
)
RETURNS TABLE (
  id        uuid,
  full_name text,
  class_id  text
)
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY
    SELECT c.id, c.full_name, c.class_id
      FROM classmates c
     WHERE c.id <> p_nominator_id
     ORDER BY c.full_name;
END;
$$;

-- ── 8. SAFE RPC: get_finalists_for_voting ────────────────────
-- Returns admin-approved finalists for a category.
-- Includes vote count only to admins — public sees names only.

CREATE OR REPLACE FUNCTION get_finalists_for_voting(
  p_category_id uuid
)
RETURNS TABLE (
  classmate_id uuid,
  full_name    text,
  class_id     text
)
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY
    SELECT c.id, c.full_name, c.class_id
      FROM award_finalists af
      JOIN classmates c ON c.id = af.classmate_id
     WHERE af.category_id = p_category_id
     ORDER BY c.full_name;
END;
$$;

-- ── 9. SAFE RPC: submit_nomination ───────────────────────────
-- Inserts nomination; enforces:
--   • nominations must be open for the category
--   • nominee must be a registered classmate
--   • nominator cannot nominate themselves
--   • one nomination per nominator per category (upsert replaces previous choice)

CREATE OR REPLACE FUNCTION submit_nomination(
  p_nominator_id uuid,
  p_category_id  uuid,
  p_nominee_id   uuid,
  p_reason       text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_category award_categories%ROWTYPE;
BEGIN
  -- Check category exists and nominations are open
  SELECT * INTO v_category
    FROM award_categories
   WHERE id = p_category_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', 'Award category not found.');
  END IF;

  IF NOT v_category.nomination_open THEN
    RETURN jsonb_build_object('success', false, 'message', 'Nominations are closed for this award.');
  END IF;

  -- Cannot nominate yourself
  IF p_nominator_id = p_nominee_id THEN
    RETURN jsonb_build_object('success', false, 'message', 'You cannot nominate yourself.');
  END IF;

  -- Upsert: if they already nominated for this category, replace their choice
  INSERT INTO award_nominations (category_id, nominator_id, nominee_id, reason)
    VALUES (p_category_id, p_nominator_id, p_nominee_id, p_reason)
  ON CONFLICT (category_id, nominator_id)
    DO UPDATE SET
      nominee_id = EXCLUDED.nominee_id,
      reason     = EXCLUDED.reason;

  RETURN jsonb_build_object('success', true, 'message', 'Your nomination has been submitted.');
END;
$$;

-- ── 10. SAFE RPC: submit_vote ────────────────────────────────
-- Inserts vote; enforces:
--   • voting must be open for the category
--   • nominee must be an approved finalist
--   • one vote per voter per category (raises error if already voted)

CREATE OR REPLACE FUNCTION submit_vote(
  p_voter_id    uuid,
  p_category_id uuid,
  p_nominee_id  uuid
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_category award_categories%ROWTYPE;
  v_is_finalist boolean;
BEGIN
  -- Check category and voting status
  SELECT * INTO v_category
    FROM award_categories
   WHERE id = p_category_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', 'Award category not found.');
  END IF;

  IF NOT v_category.voting_open THEN
    RETURN jsonb_build_object('success', false, 'message', 'Voting is not open for this award yet.');
  END IF;

  -- Confirm nominee is an approved finalist
  SELECT EXISTS (
    SELECT 1 FROM award_finalists
     WHERE category_id  = p_category_id
       AND classmate_id = p_nominee_id
  ) INTO v_is_finalist;

  IF NOT v_is_finalist THEN
    RETURN jsonb_build_object('success', false, 'message', 'That classmate is not a finalist for this award.');
  END IF;

  -- Check already voted
  IF EXISTS (
    SELECT 1 FROM award_votes
     WHERE category_id = p_category_id
       AND voter_id    = p_voter_id
  ) THEN
    RETURN jsonb_build_object('success', false, 'message', 'You have already voted for this award.');
  END IF;

  INSERT INTO award_votes (category_id, voter_id, nominee_id)
    VALUES (p_category_id, p_voter_id, p_nominee_id);

  RETURN jsonb_build_object('success', true, 'message', 'Your vote has been recorded. Thank you!');
END;
$$;

-- ── 11. SAFE RPC: get_nomination_counts ──────────────────────
-- Returns nominee id, name, class_id, and nomination count.
-- Used by admin to decide finalists. Not shown to public.

CREATE OR REPLACE FUNCTION get_nomination_counts(
  p_category_id uuid
)
RETURNS TABLE (
  nominee_id   uuid,
  full_name    text,
  class_id     text,
  nominations  bigint
)
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY
    SELECT
      c.id,
      c.full_name,
      c.class_id,
      COUNT(n.id)::bigint
    FROM award_nominations n
    JOIN classmates c ON c.id = n.nominee_id
   WHERE n.category_id = p_category_id
   GROUP BY c.id, c.full_name, c.class_id
   ORDER BY COUNT(n.id) DESC;
END;
$$;

-- =============================================================
-- DONE. Tables and functions are ready.
-- Next steps in the admin panel:
--   1. Create award categories
--   2. Open nominations — classmates nominate via /awards
--   3. Close nominations, review counts, add finalists
--   4. Open voting — classmates vote via /awards
--   5. Close voting and announce results
-- =============================================================
