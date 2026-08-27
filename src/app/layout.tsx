import type { Metadata } from "next";
import { headers } from "next/headers";
import { SITE_URL } from "@/lib/site";
import { bakeryJsonLd, serializeJsonLd } from "@/lib/structured-data";
import { Fraunces, Work_Sans } from "next/font/google";
import "./globals.css";
import { CartProvider } from "@/context/cart-context";
import { Analytics } from "@vercel/analytics/next";
import { SiteChrome } from "@/components/layout/site-chrome";
import { Toaster } from "@/components/ui/sonner";
import { getCategories } from "@/lib/services/products/get-products";
import { getSettings } from "@/lib/services/settings/get-settings";

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  weight: ["500", "600"],
});

const workSans = Work_Sans({
  variable: "--font-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  // metadataBase is what lets the relative OG image path below resolve to an
  // absolute URL, which is the only kind a link-preview scraper can fetch.
  metadataBase: new URL(SITE_URL),
  // Leads with the terms a cold searcher who's never heard of this dish
  // would actually type ("yemeni bakery halifax" already ranks the
  // Instagram account; "honeycomb bread" is the dish's real English name in
  // food media) rather than the transliteration, which only helps someone
  // who already knows it exists. Google truncates around ~60 chars, and the
  // old ordering spent that safe window on the low-traffic name while
  // "Halifax" -- the term that matters most -- sat at the truncation-risk
  // end. 49 chars here, comfortable margin.
  title: "Yemeni Honeycomb Bread, Halifax | Your Neighbour",
  description:
    "Sarah's kitchen in Halifax's North End — Yemeni honeycomb bread, made to order for local pickup.",
  alternates: { canonical: "/" },
  // This site is shared far more often than it is searched: an Instagram
  // story, a link texted to a friend. Without these the preview is a grey
  // text card, and the photography is the whole pitch.
  openGraph: {
    type: "website",
    siteName: "Your Neighbour",
    locale: "en_CA",
    url: SITE_URL,
    title: "Yemeni Honeycomb Bread, Halifax — Your Neighbour",
    description:
      "Yemeni honeycomb bread, baked to order by Sarah in Halifax's North End. Local pickup, 48 hours' notice.",
  },
  twitter: { card: "summary_large_image" },
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const [categories, settings, headerList] = await Promise.all([
    getCategories(),
    getSettings(),
    headers(),
  ]);

  // Set on the request by proxy.ts, which mints one nonce per document and
  // names it in the Content-Security-Policy. script-src is nonce +
  // 'strict-dynamic' with no 'unsafe-inline', so an inline script without
  // this attribute is silently dropped by the browser.
  const nonce = headerList.get("x-nonce") ?? undefined;

  return (
    <html
      lang="en"
      className={`${fraunces.variable} ${workSans.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col font-sans bg-background text-foreground">
        <CartProvider>
          <SiteChrome
            minAdvanceHours={settings.minAdvanceHours}
            businessName={settings.businessName}
            contactEmail={settings.contactEmail}
            categories={categories}
          >
            {children}
          </SiteChrome>
        </CartProvider>
        {/* The only dangerouslySetInnerHTML in the app. It is the standard way
            to emit JSON-LD, the payload is owner-authored and serialised
            through serializeJsonLd (which escapes the one sequence that could
            close the tag early), and nothing customer-supplied reaches it. */}
        <script
          type="application/ld+json"
          nonce={nonce}
          dangerouslySetInnerHTML={{
            __html: serializeJsonLd(
              bakeryJsonLd(settings.businessName, settings.contactEmail),
            ),
          }}
        />
        {/* Injects its script at runtime from already-trusted app JS, so
            'strict-dynamic' in the CSP covers it without a nonce, and the
            beacon is same-origin (/_vercel/insights) so connect-src 'self'
            already allows it. No CSP change needed. */}
        <Analytics />
        <Toaster />
      </body>
    </html>
  );
}
