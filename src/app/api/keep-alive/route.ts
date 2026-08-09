import { createServiceRoleClient } from "@/lib/supabase/serviceRole";

/**
 * Pinged by Vercel Cron (see vercel.json) to keep the Supabase free-tier
 * project from pausing due to inactivity.
 */
export async function GET() {
  const supabase = createServiceRoleClient();
  const { error } = await supabase.from("settings").select("key").limit(1);

  if (error) {
    return Response.json({ ok: false, error: error.message }, { status: 500 });
  }

  return Response.json({ ok: true, timestamp: new Date().toISOString() });
}
