/**
 * The site's canonical public origin.
 *
 * Deliberately not read from NEXT_PUBLIC_SITE_URL: this is what canonical
 * tags, the sitemap and Open Graph URLs are built from, and those must name
 * the one host the site should be indexed under regardless of which host a
 * given request arrived on. (Stripe's return URLs are a different problem
 * with a different answer -- see getBaseUrl in create-checkout-session.ts.)
 */
export const SITE_URL = "https://yourneighbourbakery.com";
