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
        </div>
        <MenuGrid categories={categories} products={products} />
      </section>

      <PhotoGallery photos={galleryPhotos} />
    </div>
  );
}
