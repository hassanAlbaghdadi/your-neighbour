import {
  getCategories,
  getProducts,
} from "@/lib/services/products/get-products";
import { resolveProductPhotos } from "@/lib/services/products/resolve-product-photos";
import { getSettings } from "@/lib/services/settings/get-settings";
import { getHomepagePhotos } from "@/lib/services/homepage/get-homepage-photos";
import { MenuGrid } from "@/components/menu/menu-grid";
import { HeroSection } from "@/components/home/hero-section";
import { FounderNote } from "@/components/home/founder-note";
import { OrderingNotice } from "@/components/home/ordering-notice";
import { PhotoGallery } from "@/components/home/photo-gallery";

export default async function HomePage() {
  const [categories, products, settings, homepagePhotos] = await Promise.all([
    getCategories(),
    getProducts(),
    getSettings(),
    getHomepagePhotos(),
  ]);

  const [autoHeroPhoto, ...autoGalleryPhotos] = resolveProductPhotos(products);

  const heroImageUrl = homepagePhotos.hero?.image_url ?? autoHeroPhoto?.src ?? null;
  const heroImageAlt =
    homepagePhotos.hero?.alt_text ?? autoHeroPhoto?.alt ?? "";

  const galleryPhotos =
    homepagePhotos.gallery.length > 0
      ? homepagePhotos.gallery.map((photo) => ({
          src: photo.image_url,
          alt: photo.alt_text ?? "",
        }))
      : autoGalleryPhotos;

  return (
    <div className="flex flex-1 flex-col">
      <HeroSection imageUrl={heroImageUrl} imageAlt={heroImageAlt} />

      <FounderNote />

      <OrderingNotice minAdvanceHours={settings.minAdvanceHours} />

      <section id="menu" className="scroll-mt-16">
        <div className="mx-auto w-full max-w-6xl px-4 pt-8 sm:px-6">
          <p className="text-xs font-semibold tracking-wider text-terracotta-600 uppercase">
            Order ahead
          </p>
          <h2 className="mt-2 font-heading text-2xl font-semibold text-foreground sm:text-3xl">
            The Menu
          </h2>
          {/* The shared half of every treat's description, lifted out of the
              cards. All four opened with the same seven words ("Soft Bread
              Stuffed w/ Cream Cheese Mix..."), so the part that actually
              decides the purchase -- the drizzle -- sat at the end of the
              third line, four times over. Said once here, each card is free
              to lead with its difference. Same move menu-grid.tsx already
              makes for the allergens shared by every item.

              It also gives the page somewhere to say what these *are*: the
              hero sells "fresh, baked to order" without ever naming the
              product. */}
          <p className="mt-3 max-w-prose text-sm text-muted-foreground sm:text-base">
            Every treat starts the same way — soft bread stuffed with cream
            cheese, soaked in sugar syrup. What changes is the finish.
          </p>
          {/* The sizes are quoted in two different units — one in inches,
              two in pieces — so there's no way to weigh a pan against a box
              from the labels alone. Answering it once here rather than in
              the segment labels: "9" Pan · serves 5" wrapped onto two lines
              in a 104px segment and left the separator dangling at the
              break, which made the default option the ugliest control on
              the card. */}
          <p className="mt-2 max-w-prose text-sm text-muted-foreground sm:text-base">
            A 9″ pan serves about 5; the boxes come as 12 or 24 pieces.
          </p>
        </div>
        <MenuGrid categories={categories} products={products} />
      </section>

      <PhotoGallery photos={galleryPhotos} />
    </div>
  );
}
