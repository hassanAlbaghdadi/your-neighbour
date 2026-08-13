import type { NextConfig } from "next";

// Every product/gallery photo lives in Supabase Storage and is served from
// the project's own storage host — derived from the existing env var
// instead of hardcoding the project ref, so this doesn't drift if the
// project is ever re-linked.
const supabaseHostname = process.env.NEXT_PUBLIC_SUPABASE_URL
  ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname
  : undefined;

// Static across every response, so they live here rather than in proxy.ts:
// this covers /api and static assets too, which the proxy's matcher
// deliberately skips. The Content-Security-Policy is the exception and is
// set in proxy.ts, because it carries a per-request nonce.
const securityHeaders = [
  // Opts out of MIME sniffing, so a stored file can't be coaxed into
  // executing as script by a browser second-guessing its Content-Type.
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Superseded by CSP's frame-ancestors for modern browsers; kept for
  // older ones that don't honour it.
  { key: "X-Frame-Options", value: "DENY" },
  // Send the full URL only to this origin. Order ids live in confirmation
  // page paths, and those shouldn't ride along in a Referer to anywhere
  // else.
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // None of these are used, and the storefront has no reason to ask.
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), interest-cohort=()",
  },
  // Two years, including subdomains, and preload-eligible. Only meaningful
  // over https, which is what the production deployment serves.
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
];

const nextConfig: NextConfig = {
  images: {
    remotePatterns: supabaseHostname
      ? [
          {
            protocol: "https",
            hostname: supabaseHostname,
            pathname: "/storage/v1/object/public/**",
          },
        ]
      : [],
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
