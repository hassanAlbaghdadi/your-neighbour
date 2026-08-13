import { createServiceRoleClient } from "@/lib/supabase/serviceRole";

/**
 * Pinged by Vercel Cron (see vercel.json) to keep the Supabase free-tier
 * project from pausing due to inactivity, and to prune expired
 * rate-limiter rows while we're here — that table grows one row per
 * distinct client IP and nothing else sweeps it.
 */
export async function GET(request: Request) {
  // Vercel Cron sends this header when CRON_SECRET is configured on the
  // project. Enforced only when the secret is actually set, so adding it
  // is opt-in and its absence can't silently break the schedule — but
  // setting it is recommended, and without it this route is open to
  // anyone who finds the path.
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const authorization = request.headers.get("authorization");
    if (authorization !== `Bearer ${cronSecret}`) {
      return new Response("Unauthorized", { status: 401 });
    }
  }

  const supabase = createServiceRoleClient();
  const { error } = await supabase.from("settings").select("key").limit(1);

  if (error) {
    // Logged, not returned: this route is reachable by anyone who guesses
    // the path, and a raw Postgres error is free reconnaissance.
    console.error("Keep-alive query failed:", error);
    return Response.json({ ok: false }, { status: 500 });
  }

  const { error: pruneError } = await supabase.rpc("prune_rate_limits");
  if (pruneError) {
    // Non-fatal: the keep-alive itself succeeded, and a missed prune just
    // means the table stays a little larger until tomorrow's run.
    console.error("Rate limit prune failed:", pruneError);
  }

  return Response.json({ ok: true, timestamp: new Date().toISOString() });
}
