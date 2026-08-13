/**
 * Content-Security-Policy for page responses, built per-request so each one
 * carries a fresh nonce.
 *
 * Kept as a pure function separate from proxy.ts so the production policy
 * can be asserted in tests — the dev server necessarily runs a looser
 * variant (React's refresh runtime needs `unsafe-eval`, Turbopack's HMR
 * needs a websocket), and a policy you can only observe in dev is a policy
 * whose real-world form nobody ever checks.
 */
export function buildContentSecurityPolicy(
  nonce: string,
  { isDev, supabaseUrl }: { isDev: boolean; supabaseUrl?: string },
): string {
  // Supabase serves three things the browser talks to directly: PostgREST,
  // Auth, and Storage — all on the project's own origin.
  let supabaseOrigin = "";
  if (supabaseUrl) {
    try {
      supabaseOrigin = new URL(supabaseUrl).origin;
    } catch {
      // A malformed env var shouldn't take the site down with a broken
      // header; the directives below just end up without the origin.
    }
  }

  const directives = [
    "default-src 'self'",
    // 'strict-dynamic' means the nonce'd Next bootstrap can load the app's
    // own chunks, while an injected <script> — which by definition can't
    // guess the nonce — cannot. Note that browsers honouring
    // 'strict-dynamic' deliberately ignore 'self' here; it's retained for
    // older ones that don't.
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ""}`,
    // 'unsafe-inline' rather than a nonce, deliberately: `style` attributes
    // (product-card's variant indicator positions one) are governed by
    // style-src when style-src-attr is absent, so a nonce-only policy
    // silently breaks them. Style injection is a far narrower problem than
    // script injection, and script-src above is where the real defense is.
    "style-src 'self' 'unsafe-inline'",
    // blob: covers the client-side compressed-photo previews in the admin
    // uploader; the Supabase origin serves every product and gallery photo.
    `img-src 'self' blob: data:${supabaseOrigin ? ` ${supabaseOrigin}` : ""}`,
    // next/font self-hosts Fraunces and Work Sans at build time, so no
    // external font origin is needed.
    "font-src 'self'",
    `connect-src 'self'${supabaseOrigin ? ` ${supabaseOrigin}` : ""}${isDev ? " ws: wss:" : ""}`,
    // Checkout is a top-level redirect to Stripe, not an embedded iframe,
    // so nothing needs framing privileges in either direction.
    "frame-src 'none'",
    "frame-ancestors 'none'",
    "object-src 'none'",
    "base-uri 'self'",
    // Server Actions post back to this origin only.
    "form-action 'self'",
  ];

  // Omitted in dev: the local server is plain http, and upgrading its own
  // subresource requests to https would break them.
  if (!isDev) {
    directives.push("upgrade-insecure-requests");
  }

  return directives.join("; ");
}
