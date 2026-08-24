import type { Metadata } from "next";
import { Fraunces, Work_Sans } from "next/font/google";
import "./globals.css";
import { CartProvider } from "@/context/cart-context";
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
  title: "Your Neighbour | Fresh Baked Goods, Pre-Ordered",
  description:
    "A warm, community-focused online ordering platform for pre-ordering fresh baked goods for local pickup.",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const [categories, settings] = await Promise.all([
    getCategories(),
    getSettings(),
  ]);

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
        <Toaster />
      </body>
    </html>
  );
}
