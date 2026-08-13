import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { buildContentSecurityPolicy } from "@/lib/security/csp";

/**
 * Redirects an unauthenticated visitor to the login page, and a logged-in
 * one away from it. Only reached for /admin paths — the proxy itself now
 * runs on every page so it can attach a per-request CSP nonce, and calling
 * Supabase on every storefront request to answer a question only /admin
 * asks would be a pointless round-trip on the hot path.
 *
 * `requestHeaders` carries the nonce that Next reads during SSR, so every
 * NextResponse.next() below has to be built from it rather than from the
 * untouched request — otherwise admin pages would receive a policy naming
 * a nonce that none of their scripts carry, and fail to boot.
 */
async function guardAdminRoutes(
  request: NextRequest,
  requestHeaders: Headers,
): Promise<NextResponse> {
  let response = NextResponse.next({ request: { headers: requestHeaders } });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          response = NextResponse.next({ request: { headers: requestHeaders } });
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isLoginPage = request.nextUrl.pathname === "/admin/login";

  if (!user && !isLoginPage) {
    const url = request.nextUrl.clone();
    url.pathname = "/admin/login";
    return NextResponse.redirect(url);
  }

  if (user && isLoginPage) {
    const url = request.nextUrl.clone();
    url.pathname = "/admin";
    return NextResponse.redirect(url);
  }

  return response;
}

export async function proxy(request: NextRequest) {
  const nonce = crypto.randomUUID();
  const csp = buildContentSecurityPolicy(nonce, {
    isDev: process.env.NODE_ENV === "development",
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
  });

  // Set on the *request* headers as well as the response: Next reads the
  // inbound CSP header during SSR to find the nonce, and stamps it onto the
  // framework and page scripts it emits. Without this the nonce would be in
  // the policy but on none of the scripts, and the page would fail to boot.
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);

  const response = request.nextUrl.pathname.startsWith("/admin")
    ? await guardAdminRoutes(request, requestHeaders)
    : NextResponse.next({ request: { headers: requestHeaders } });

  response.headers.set("Content-Security-Policy", csp);
  return response;
}

export const config = {
  matcher: [
    /*
     * Every page request, so each document gets its own nonce. Excluded:
     * - api        — JSON responses with no scripts to govern; the Stripe
     *                webhook in particular must not be touched.
     * - _next/*    — build output and the image optimizer, served static.
     * - favicon    — no document.
     * Prefetches are skipped too: next/link warms the router cache with
     * responses that are never rendered as documents, so spending a nonce
     * (and an admin auth round-trip) on them is waste.
     */
    {
      source: "/((?!api|_next/static|_next/image|favicon.ico).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
