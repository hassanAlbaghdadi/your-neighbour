import type { Product } from "@/lib/services/products/get-products";

export interface ProductPhoto {
  src: string;
  alt: string;
}

function resolveImage(product: Product): string | null {
  const variantImage = product.variants.find((v) => v.image_url)?.image_url;
  return variantImage ?? product.image_url ?? null;
}

// De-duped, ordered list of product photos — the shared auto-fallback
// source for any storefront section that shows product photography
// without admin curation (homepage hero/gallery, the Our Story page).
export function resolveProductPhotos(products: Product[]): ProductPhoto[] {
  const photos = products
    .map((product) => {
      const src = resolveImage(product);
      return src ? { src, alt: product.name } : null;
    })
    .filter((photo): photo is ProductPhoto => photo !== null);

  return Array.from(new Map(photos.map((photo) => [photo.src, photo])).values());
}
