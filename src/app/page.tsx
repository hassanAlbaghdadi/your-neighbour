import {
  getCategories,
  getProducts,
  type Product,
} from "@/lib/services/products/get-products";
import { getSettings } from "@/lib/services/settings/get-settings";
import { getHomepagePhotos } from "@/lib/services/homepage/get-homepage-photos";
import { MenuGrid } from "@/components/menu/menu-grid";
import { HeroSection } from "@/components/home/hero-section";
import { FounderNote } from "@/components/home/founder-note";
import { StoryFacts } from "@/components/home/story-facts";
import { PhotoGallery } from "@/components/home/photo-gallery";

function resolveImage(product: Product): string | null {
  const variantImage = product.variants.find((v) => v.image_url)?.image_url;
  return variantImage ?? product.image_url ?? null;
}

export default async function HomePage() {
  const [categories, products, settings, homepagePhotos] = await Promise.all([
    getCategories(),
    getProducts(),
    getSettings(),
    getHomepagePhotos(),
  ]);

  const autoPhotos = products
    .map((product) => {
      const src = resolveImage(product);
      return src ? { src, alt: product.name } : null;
    })
    .filter((photo): photo is { src: string; alt: string } => photo !== null);
  const uniqueAutoPhotos = Array.from(
    new Map(autoPhotos.map((photo) => [photo.src, photo])).values(),
  );
  const [autoHeroPhoto, ...autoGalleryPhotos] = uniqueAutoPhotos;

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

      <StoryFacts minAdvanceHours={settings.minAdvanceHours} />

      <PhotoGallery photos={galleryPhotos} />

      <section id="menu" className="scroll-mt-16">
        <div className="mx-auto w-full max-w-6xl px-4 pt-8 sm:px-6">
          <p className="text-xs font-semibold tracking-wider text-terracotta-600 uppercase">
            Order ahead
          </p>
          <h2 className="mt-2 font-heading text-2xl font-semibold text-foreground sm:text-3xl">
            The Menu
          </h2>
        </div>
        <MenuGrid categories={categories} products={products} />
      </section>
    </div>
  );
}
