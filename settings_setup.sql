-- =============================================================
-- 3A12 REUNION SYSTEM — Site Settings & Programme Setup
-- Run once in Supabase → SQL Editor → Run
-- =============================================================

-- ── 1. SITE SETTINGS (key-value store) ───────────────────────
-- One row per setting key. Admin can update values via the
-- Settings page. Public pages read from this table.

CREATE TABLE IF NOT EXISTS site_settings (
  key         text PRIMARY KEY,
  value       text,
  label       text,          -- human-readable label for the admin UI
  description text,          -- hint shown below the field
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- ── 2. PROGRAMME ITEMS ───────────────────────────────────────
-- Ordered list of schedule items shown on the public homepage.

CREATE TABLE IF NOT EXISTS programme_items (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  time_label  text NOT NULL,           -- e.g. "10:00 AM"
  title       text NOT NULL,           -- e.g. "Arrival & Registration"
  description text NOT NULL DEFAULT '', -- e.g. "Welcome, check-in and networking."
  sort_order  integer NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_programme_items_sort
  ON programme_items (sort_order ASC);

-- ── 3. ROW LEVEL SECURITY ─────────────────────────────────────

ALTER TABLE site_settings   ENABLE ROW LEVEL SECURITY;
ALTER TABLE programme_items ENABLE ROW LEVEL SECURITY;

-- Public can read all settings (needed by App.jsx / Register.jsx)
DROP POLICY IF EXISTS "Public read site_settings" ON site_settings;
CREATE POLICY "Public read site_settings"
  ON site_settings FOR SELECT USING (true);

-- Only authenticated admins can write settings
DROP POLICY IF EXISTS "Auth manage site_settings" ON site_settings;
CREATE POLICY "Auth manage site_settings"
  ON site_settings FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Public can read programme items
DROP POLICY IF EXISTS "Public read programme_items" ON programme_items;
CREATE POLICY "Public read programme_items"
  ON programme_items FOR SELECT USING (true);

-- Only authenticated admins can write programme items
DROP POLICY IF EXISTS "Auth manage programme_items" ON programme_items;
CREATE POLICY "Auth manage programme_items"
  ON programme_items FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ── 4. SEED DEFAULT SETTINGS ─────────────────────────────────
-- INSERT … ON CONFLICT DO NOTHING so re-running this script
-- never overwrites admin changes.

INSERT INTO site_settings (key, value, label, description) VALUES
  ('event_name',          '5th Anniversary Reunion',                        'Event Name',              'Shown in the hero heading and registration confirmation.'),
  ('event_tagline',       'Different Paths • One Beginning • One Family',   'Event Tagline',           'Shown below the event name and in the footer.'),
  ('event_date',          '2026-12-31T10:00:00',                            'Event Date & Time',       'ISO 8601 format — used for the countdown timer. e.g. 2026-12-31T10:00:00'),
  ('event_venue',         '',                                               'Venue',                   'Location of the reunion. Shown on the homepage if set.'),
  ('hero_description',    'Five years after leaving SHS, we''re coming together once again to reconnect, remember, celebrate and create new memories.', 'Hero Description', 'Paragraph shown under the hero heading.'),
  ('about_copy',          'We entered SHS as young students with different dreams. In 2021, we left as classmates ready to face the world. Today, after five incredible years, we are coming together to celebrate how far we''ve travelled and the people we''ve become.', 'About Section Copy', 'Paragraph shown in the Our Story section.'),
  ('default_contribution','500',                                            'Default Contribution (GH₵)', 'Global fallback amount used when no per-classmate override is set. Also used as the starting value for new registrations.'),
  ('registration_open',   'true',                                           'Registration Open',       'Set to false to close the registration form to new submissions.'),
  ('footer_copyright',    '© 2026 Class of 2021 Reunion. All rights reserved.', 'Footer Copyright',  'Copyright line shown at the bottom of every page.')
ON CONFLICT (key) DO NOTHING;

-- ── 5. SEED DEFAULT PROGRAMME ITEMS ──────────────────────────

INSERT INTO programme_items (time_label, title, description, sort_order) VALUES
  ('10:00 AM', 'Arrival & Registration',    'Welcome, check-in and networking.',              1),
  ('11:00 AM', 'Opening Ceremony',          'Prayer, welcome address and introductions.',     2),
  ('12:00 PM', 'SHS Memories & Games',      'Trivia, old pictures, stories and fun activities.', 3),
  ('1:00 PM',  'Lunch & Networking',        'Good food, conversations and connections.',      4),
  ('3:00 PM',  'Awards & Recognition',      'Celebrating classmates and our teachers.',       5),
  ('4:00 PM',  'Music, Dance & Photography','Let''s make some unforgettable memories.',       6)
ON CONFLICT DO NOTHING;

-- =============================================================
-- DONE.
-- New tables: site_settings, programme_items
-- Default settings and programme seeded (safe to re-run).
-- =============================================================
