import {
  getCategories,
  getProducts,
} from "@/lib/services/products/get-products";
import { resolveProductPhotos } from "@/lib/services/products/resolve-product-photos";
import { getMostPopularProductId } from "@/lib/services/products/get-popular-product";
import { getSettings } from "@/lib/services/settings/get-settings";
import { getHomepagePhotos } from "@/lib/services/homepage/get-homepage-photos";
import { Info } from "lucide-react";
import { MenuGrid } from "@/components/menu/menu-grid";
import { HeroSection } from "@/components/home/hero-section";
import { FounderNote } from "@/components/home/founder-note";
import { PhotoGallery } from "@/components/home/photo-gallery";
import { sharedAllergens, formatAllergenProse } from "@/lib/allergens";

export default async function HomePage() {
  const [categories, products, settings, homepagePhotos, mostPopularId] =
    await Promise.all([
      getCategories(),
      getProducts(),
      getSettings(),
      getHomepagePhotos(),
      getMostPopularProductId(),
    ]);

  const [autoHeroPhoto, ...autoGalleryPhotos] = resolveProductPhotos(products);

  const heroImageUrl = homepagePhotos.hero?.image_url ?? autoHeroPhoto?.src ?? null;
  const heroImageAlt =
    homepagePhotos.hero?.alt_text ?? autoHeroPhoto?.alt ?? "";

  // Computed here rather than inside MenuGrid so every line of menu intro
  // copy is written in one file. It was split across two components, which is
  // how the page ended up with three consecutive paragraphs that nobody had
  // ever read next to each other.
  const shared = sharedAllergens(products.map((product) => product.allergens));

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

      <FounderNote minAdvanceHours={settings.minAdvanceHours} />

      <section id="menu" className="scroll-mt-16">
        <div className="mx-auto w-full max-w-6xl px-4 pt-8 sm:px-6">
          {/* Not "Order ahead" any more. Once the band above states the
              terms outright, that eyebrow sat 77px below the words "Order 48
              hours ahead" in the loudest small-text treatment on the page and
              said them again. The eyebrow/heading pair is kept because the
              gallery below uses the same one ("From the kitchen" / "A closer
              look") -- dropping it here alone would leave the two sections
              looking like they came from different pages. */}
          <p className="text-xs font-semibold tracking-wider text-terracotta-600 uppercase">
            What we bake
          </p>
          <h2 className="mt-2 font-heading text-2xl font-semibold text-foreground sm:text-3xl">
            The Menu
          </h2>
          {/* The recipe line that used to sit here is in the hero subhead
              now. Its original job -- factoring the shared opening out of
              six card descriptions that all began "Soft Bread Stuffed w/
              Cream Cheese Mix..." -- is finished: every description now
              leads with its own difference, so nothing was being deduped
              any more. What was left was a definition of the product, and a
              definition belongs at the top of the page, not three lines
              above the grid on the reader's second screen.

              A menu-wide allergen note, though, can't move anywhere. It's
              the one line here where being easy to skip is the defect, so
              it stays visible -- no disclosure, no tap. What changes is that
              it stops being set as prose. Two sentences in the same grey as
              everything else read as more writing to wade through; an icon
              and a single small line read as a legend for the grid below,
              which is what it is.

              The icon pairs with the Clock in founder-note.tsx on purpose:
              same size, same terracotta, same muted text, so the page has
              one recognisable treatment for "fact about ordering, not
              prose" rather than two one-offs.

              The parenthetical is the non-exhaustiveness caveat in its
              shortest form -- the cards finish the thought with "Also
              contains ...", where "Also" only means anything because of
              this line. It's measured: at 12px this row has 323px of text
              width on a 375px phone, the allergen clause alone is 232px,
              and every phrasing that carries the caveat runs 324-380px. So
              the caveat costs a second line no matter how it's worded, and
              a second 12px line is worth more than a missing warning on the
              one row here that's load-bearing for safety.

              whitespace-nowrap so the wrap lands at the parenthesis and the
              caveat moves as a unit. Left to itself the break fell inside it
              ("... see each / item for more"), which read as a sentence that
              had overflowed rather than two facts stacked.

              Renders nothing at all when the menu shares no allergen; see
              lib/allergens.ts for why that can happen. */}
          {shared.length > 0 && (
            <p className="mt-6 flex items-start gap-1.5 text-xs text-muted-foreground">
              <Info className="mt-px size-3.5 shrink-0 text-terracotta-600" />
              <span>
                All items contain {formatAllergenProse(shared)}{" "}
                <span className="whitespace-nowrap">
                  (see each item for more)
                </span>
              </span>
            </p>
          )}
        </div>
        <MenuGrid
          categories={categories}
          products={products}
          mostPopularId={mostPopularId}
          sharedAllergens={shared}
        />
      </section>

      <PhotoGallery photos={galleryPhotos} />
    </div>
  );
}
