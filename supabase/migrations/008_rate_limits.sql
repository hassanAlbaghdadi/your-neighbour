-- ======================================================================
-- MIGRATION 008: RATE LIMITING
-- Run this ONCE in the Supabase SQL Editor (or via `supabase db push`)
-- against the live project before deploying the app code that calls it.
--
-- Order creation is public and unauthenticated, and every order reserves a
-- pickup-capacity slot the moment it's created — held until its Stripe
-- session expires. With max_orders_per_day defaulting to 15, a script could
-- burn an entire day's capacity in one burst and lock real customers out,
-- over and over, without ever paying a cent.
--
-- Counters live in Postgres rather than in the app because the app runs on
-- serverless functions: per-instance in-memory state resets constantly and
-- isn't shared between concurrent instances, so it would count a fraction
-- of the real traffic.
-- ======================================================================

BEGIN;

CREATE TABLE rate_limits (
  key TEXT PRIMARY KEY,
  count INT NOT NULL DEFAULT 0,
  window_start TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Not readable or writable by anon/authenticated at all: the only caller
-- is the server-side service-role client, which bypasses RLS. Enabling RLS
-- with no policy is what makes that explicit — the default-deny is the
-- policy.
ALTER TABLE rate_limits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON rate_limits FROM anon, authenticated;

-- ----------------------------------------------------------------------
-- check_rate_limit: fixed-window counter. Returns TRUE when the call is
-- allowed, FALSE when the caller has exhausted its window.
--
-- The whole read-modify-write happens inside one INSERT ... ON CONFLICT,
-- which takes a row lock on the conflicting key — so concurrent calls for
-- the same key serialize instead of both reading a stale count. Doing this
-- as a SELECT-then-UPDATE would reintroduce exactly the check-then-act
-- race that migration 006 removed from the capacity check.
-- ----------------------------------------------------------------------
CREATE OR REPLACE FUNCTION check_rate_limit(
  p_key TEXT,
  p_limit INT,
  p_window_seconds INT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
DECLARE
  v_count INT;
  v_expired BOOLEAN;
BEGIN
  INSERT INTO rate_limits AS rl (key, count, window_start)
  VALUES (p_key, 1, NOW())
  ON CONFLICT (key) DO UPDATE
    SET
      -- A window that has already elapsed starts over at 1 rather than
      -- being deleted and re-inserted — same effect, one statement.
      count = CASE
        WHEN rl.window_start < NOW() - make_interval(secs => p_window_seconds)
          THEN 1
        ELSE rl.count + 1
      END,
      window_start = CASE
        WHEN rl.window_start < NOW() - make_interval(secs => p_window_seconds)
          THEN NOW()
        ELSE rl.window_start
      END
  RETURNING rl.count INTO v_count;

  RETURN v_count <= p_limit;
END;
$$;

-- ----------------------------------------------------------------------
-- prune_rate_limits: housekeeping so the table doesn't grow without bound
-- (one row per distinct IP, forever, otherwise). Called from the existing
-- daily /api/keep-alive cron — there's no separate schedule to set up.
-- ----------------------------------------------------------------------
CREATE OR REPLACE FUNCTION prune_rate_limits()
RETURNS void
LANGUAGE sql
AS $$
  DELETE FROM rate_limits WHERE window_start < NOW() - INTERVAL '24 hours';
$$;

COMMIT;
