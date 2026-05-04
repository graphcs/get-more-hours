-- Idempotency log for Stripe webhook deliveries.
--
-- Stripe retries webhooks aggressively (and occasionally redelivers events
-- that were already acknowledged with 2xx). Without deduplication we double
-- insert billing rows and double-trigger document generation. We dedupe on
-- event.id, the canonical "this exact delivery" identifier from Stripe.
--
-- The webhook handler INSERTs the row before any side effects; on a primary
-- key violation it short-circuits with a 200 so Stripe stops retrying.

CREATE TABLE stripe_events (
  event_id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  received_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- This table is only ever written/read by the webhook using the service role,
-- so RLS is enabled with no policies (denies all by default for anon/auth).
ALTER TABLE stripe_events ENABLE ROW LEVEL SECURITY;
