import { SITE_URL } from "@/lib/site";
import { INSTAGRAM_URL } from "@/lib/social";

/**
 * One Bakery node, and deliberately only one.
 *
 * What it buys: it tells Google that this domain and the Instagram account
 * are the same entity, and that the entity is in Halifax. That association
 * is what lets the site surface alongside a Google Business Profile rather
 * than as an unrelated web result -- which for a local pickup-only bakery is
 * worth more than any amount of on-page keyword work.
 *
 * What it deliberately omits:
 *
 * - `streetAddress`. The pickup address is a private residence. `addressLocality`
 *   plus `addressRegion` carry the local relevance at no privacy cost, and a
 *   service-area business is the correct shape here anyway.
 * - Per-product `Product`/`Offer` nodes. Six prices that live in Supabase would
 *   have to be kept in sync with a second copy in the markup, and without
 *   reviews or shipping the rich-result payoff is close to nil.
 */
export function bakeryJsonLd(businessName: string, contactEmail: string) {
  return {
    "@context": "https://schema.org",
    "@type": "Bakery",
    name: businessName,
    url: SITE_URL,
    image: `${SITE_URL}/opengraph-image.jpg`,
    description:
      "Yemeni honeycomb bread (Khaliat El Nahal) baked to order for local pickup in Halifax.",
    address: {
      "@type": "PostalAddress",
      addressLocality: "Halifax",
      addressRegion: "NS",
      addressCountry: "CA",
    },
    areaServed: { "@type": "City", name: "Halifax" },
    servesCuisine: "Yemeni",
    priceRange: "$$",
    sameAs: [INSTAGRAM_URL],
    ...(contactEmail ? { email: contactEmail } : {}),
  };
}

/**
 * JSON is embedded in an HTML <script>, where the one sequence that can break
 * out is `</script>`. Escaping `<` closes that off; the values here are
 * owner-authored rather than customer-authored, so this is a belt on top of
 * braces rather than the only thing standing between us and injection.
 */
export function serializeJsonLd(data: unknown): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}
