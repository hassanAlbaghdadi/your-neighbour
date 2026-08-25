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
          {/* No eyebrow. It read "What we bake", and once the lead below
              was written that line was saying a third thing nobody needed:
              the heading already names the section, the sentence already
              says what we bake, and "What" opened both of them two lines
              apart. It also put a third "bake" within one screen of the h1
              ("Fresh, baked to order") and the founder band ("Baked by
              Sarah"), all in the loudest small-text treatment on the page.

              This is the same call product-card.tsx made when it dropped
              the category eyebrow: a label that repeats what's next to it
              costs a line and returns nothing.

              The gallery below keeps its own ("From the kitchen" / "A
              closer look") because that one carries information its
              heading doesn't -- whose kitchen. Parity was the argument for
              keeping this one, but the two sections stopped being twins the
              moment this one grew lead copy the gallery doesn't have, and
              2,500px of grid sits between them.

              What's left is three elements with three jobs: where you are,
              what it is, what to watch for. */}
          <h2 className="font-heading text-2xl font-semibold text-foreground sm:text-3xl">
            The Menu
          </h2>
          {/* One sentence, and it's the one that changes how the grid
              below is read. Every card leads with its own difference now
              ("No coating, no drizzle", "Rolled in cinnamon sugar",
              "Chocolate chips right through the filling"), which is right
              for scanning but leaves a first-time reader six items with no
              common ground -- the thing they all are went unsaid anywhere
              near the cards. This states the shared base once, then hands
              off: what's left to compare is the finish, which is exactly
              what each card leads with.

              One sentence at one measure (max-w-lg: 2 lines on desktop,
              3 on a phone) on purpose. Anything longer stops reading as a
              caption on the grid and starts reading as an About paragraph
              standing between the reader and the menu -- the failure this
              section already had once, when three consecutive paragraphs
              sat here.

              The payoff clause is the only part in foreground weight, and
              whitespace-nowrap keeps it whole. It's the instruction
              ("compare the finishes"); the setup is context and can stay
              muted, so the line resolves in one glance without getting
              longer. Two weights, no extra words. Deleting the clause
              saves nothing, measured: at both widths the sentence wraps to
              the same line count either way, and without it that last line
              sits 12% full with "syrup." orphaned on it.

              "pillow-soft", not "soft, pillowy": those are two words for
              one attribute, which is the same padding as "a sweet sugar
              syrup" for something sweet by definition. One compound word
              buys the texture and keeps both desktop lines 100% full;
              adding a second adjective ("golden, pillow-soft") tips desktop
              to three lines with the last 19% full. Measured at 375 and
              1280.

              The hero deliberately does not repeat this -- see the note in
              hero-section.tsx. */}
          <p className="mt-4 max-w-lg text-sm leading-relaxed text-muted-foreground sm:text-base">
            Every treat starts the same way — pillow-soft bread stuffed with
            cream cheese, soaked in sugar syrup.{" "}
            <span className="font-medium whitespace-nowrap text-foreground">
              What changes is the finish.
            </span>
          </p>
          {/* A menu-wide allergen note, though, can't move anywhere. It's
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
            <p className="mt-5 flex items-start gap-1.5 text-xs text-muted-foreground">
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
