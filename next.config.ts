import type { NextConfig } from "next";

// Every product/gallery photo lives in Supabase Storage and is served from
// the project's own storage host — derived from the existing env var
// instead of hardcoding the project ref, so this doesn't drift if the
// project is ever re-linked.
const supabaseHostname = process.env.NEXT_PUBLIC_SUPABASE_URL
  ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname
  : undefined;

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
};

export default nextConfig;
