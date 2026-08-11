import { cn } from "@/lib/utils";

interface GalleryPhoto {
  src: string;
  alt: string;
}

export function PhotoGallery({ photos }: { photos: GalleryPhoto[] }) {
  if (photos.length === 0) return null;

  return (
    <section className="border-b border-border bg-ivory-50">
      <div className="mx-auto w-full max-w-6xl px-4 py-14 sm:px-6">
        <p className="text-xs font-semibold tracking-wider text-terracotta-600 uppercase">
          From the kitchen
        </p>
        <h2 className="mt-2 font-heading text-2xl font-semibold text-foreground sm:text-3xl">
          A closer look
        </h2>

        <div className="mt-8 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          {photos.map((photo, index) => (
            <div
              key={photo.src}
              className={cn(
                "overflow-hidden rounded-xl bg-muted",
                index === 0
                  ? "col-span-2 aspect-16/9 sm:aspect-2/1"
                  : "aspect-square",
              )}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={photo.src}
                alt={photo.alt}
                className="h-full w-full object-cover"
              />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
