import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

/**
 * Text response with no scripts, so unlike the HTML routes this one carries
 * nothing the per-request CSP nonce needs to govern and is safe to serve
 * statically.
 *
 * /checkout and /confirmation are disallowed because neither is useful in a
 * search result and the latter renders a customer's name, pickup time and
 * collection address.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/admin", "/checkout", "/confirmation/"],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
