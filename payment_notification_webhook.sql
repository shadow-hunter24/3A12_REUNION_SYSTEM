-- =============================================================
-- 3A12 REUNION SYSTEM — Payment Notification Webhook
--
-- Run this AFTER deploying the notify-payment Edge Function.
--
-- What this does:
--   Creates a Supabase Database Webhook that fires whenever a
--   new row is inserted into contribution_payments.
--   The webhook calls the notify-payment Edge Function, which
--   sends the member a payment confirmation email (and a
--   congratulations email if they are now fully paid).
--
-- Prerequisites:
--   1. Edge Function deployed:
--      supabase functions deploy notify-payment
--   2. Edge Function secrets set in Supabase dashboard:
--      RESEND_API_KEY, FROM_EMAIL
--   3. The pg_net extension must be enabled (it is by default
--      on all Supabase projects).
-- =============================================================

-- Enable pg_net if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- =============================================================
-- Drop existing webhook function/trigger if re-running
-- =============================================================

DROP TRIGGER  IF EXISTS trg_notify_payment_inserted ON contribution_payments;
DROP FUNCTION IF EXISTS notify_payment_inserted();

-- =============================================================
-- Function: calls the Edge Function via HTTP POST
-- =============================================================

CREATE OR REPLACE FUNCTION notify_payment_inserted()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_project_ref text;
  v_edge_url    text;
  v_payload     jsonb;
BEGIN
  -- Derive the Edge Function URL from the Supabase project URL.
  -- SUPABASE_URL is available as a built-in config variable.
  -- Format: https://<ref>.supabase.co → functions/v1/notify-payment
  v_project_ref := current_setting('app.supabase_url', true);

  -- Fallback: hard-code your project ref if the setting is unavailable.
  -- Replace the value below with your actual project ref.
  IF v_project_ref IS NULL OR v_project_ref = '' THEN
    v_project_ref := 'https://afslikzpqomrfxdsgcmg.supabase.co';
  END IF;

  v_edge_url := v_project_ref || '/functions/v1/notify-payment';

  -- Build the webhook payload in the same shape Supabase webhooks use
  v_payload := jsonb_build_object(
    'type',       'INSERT',
    'table',      'contribution_payments',
    'schema',     'public',
    'record',     row_to_json(NEW)::jsonb,
    'old_record', NULL
  );

  -- Fire-and-forget HTTP POST — non-blocking
  PERFORM extensions.http_post(
    url     := v_edge_url,
    body    := v_payload::text,
    params  := '{}',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      -- The Authorization header uses the Supabase anon key.
      -- The Edge Function itself uses the service role key internally
      -- (set as a secret), so the anon key here just authenticates
      -- the incoming HTTP request to the function endpoint.
      'Authorization', 'Bearer ' || current_setting('app.supabase_anon_key', true)
    )::text
  );

  RETURN NEW;
END;
$$;

-- =============================================================
-- Trigger: fires AFTER INSERT on contribution_payments
-- =============================================================

CREATE TRIGGER trg_notify_payment_inserted
  AFTER INSERT ON contribution_payments
  FOR EACH ROW
  EXECUTE FUNCTION notify_payment_inserted();

-- =============================================================
-- Grant execute to authenticated role (used by the trigger context)
-- =============================================================

GRANT EXECUTE ON FUNCTION notify_payment_inserted() TO authenticated;
GRANT EXECUTE ON FUNCTION notify_payment_inserted() TO service_role;

-- =============================================================
-- ALTERNATIVE: Use the Supabase Dashboard Webhook UI instead
-- (easier — no pg_net required)
--
-- Go to:
--   Supabase Dashboard → Database → Webhooks → Create webhook
--
-- Settings:
--   Name:    notify-payment
--   Table:   contribution_payments
--   Events:  INSERT  (tick only INSERT)
--   Type:    HTTP Request
--   URL:     https://afslikzpqomrfxdsgcmg.supabase.co/functions/v1/notify-payment
--   Headers:
--     Content-Type:  application/json
--     Authorization: Bearer <your-supabase-anon-key>
--
-- This is the recommended approach — no SQL needed.
-- =============================================================
