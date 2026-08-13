import "server-only";
import { headers } from "next/headers";
import { createServiceRoleClient } from "@/lib/supabase/serviceRole";

interface RateLimitRule {
  /** Namespace, so an IP limit and an email limit never share a counter. */
  scope: string;
  /** The thing being limited — an IP, an email address. */
  identifier: string;
  limit: number;
  windowSeconds: number;
}

/**
 * Returns true when every rule still has room, false when any one of them
 * is exhausted.
 *
 * Deliberately fails OPEN. This guards a bakery's order form, not a vault:
 * if the limiter itself is broken, refusing every order would turn a
 * degraded dependency into a total outage of the thing that makes money.
 * The abuse it prevents is a nuisance; blocking real customers is worse.
 */
export async function checkRateLimits(
  rules: RateLimitRule[],
): Promise<boolean> {
  const supabase = createServiceRoleClient();

  try {
    const results = await Promise.all(
      rules.map((rule) =>
        supabase.rpc("check_rate_limit", {
          p_key: `${rule.scope}:${rule.identifier}`,
          p_limit: rule.limit,
          p_window_seconds: rule.windowSeconds,
        }),
      ),
    );

    for (const { data, error } of results) {
      if (error) {
        console.error("Rate limit check failed, allowing through:", error);
        return true;
      }
      if (data === false) return false;
    }
    return true;
  } catch (error) {
    console.error("Rate limit check threw, allowing through:", error);
    return true;
  }
}

/**
 * Best-effort client IP for rate-limiting purposes.
 *
 * `x-forwarded-for` is client-supplied and trivially spoofed in general —
 * but on Vercel the platform's own proxy rewrites it, and the leftmost
 * entry is the real client. Worth being clear about what this is and isn't:
 * it's a speed bump against casual scripted abuse, not an identity, and
 * nothing security-sensitive should be keyed on it.
 */
export async function getClientIp(): Promise<string> {
  const headerList = await headers();
  const forwarded = headerList.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  return headerList.get("x-real-ip") ?? "unknown";
}
