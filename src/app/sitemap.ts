import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

/** The two pages worth indexing. Checkout and confirmation are deliberately absent. */
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: SITE_URL, changeFrequency: "weekly", priority: 1 },
    { url: `${SITE_URL}/our-story`, changeFrequency: "monthly", priority: 0.8 },
  ];
}
