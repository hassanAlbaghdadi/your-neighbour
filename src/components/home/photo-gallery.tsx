interface GalleryPhoto {
  src: string;
  alt: string;
}

export function PhotoGallery({ photos }: { photos: GalleryPhoto[] }) {
  if (photos.length === 0) return null;

  return (
    <section className="border-b border-border bg-ivory-50">
      <div className="mx-auto w-full max-w-6xl py-14">
        <div className="px-4 sm:px-6">
          <p className="text-xs font-semibold tracking-wider text-terracotta-600 uppercase">
            From the kitchen
          </p>
          <h2 className="mt-2 font-heading text-2xl font-semibold text-foreground sm:text-3xl">
            A closer look
          </h2>
        </div>

        {/* Horizontal scroll-snap strip rather than a fixed-column grid: with
            a curated, sometimes-sparse photo count (as few as 1-2), a grid
            leaves dangling empty cells, while this stays full and swipeable
            at any count. */}
        <div className="mt-8 flex snap-x snap-mandatory gap-4 overflow-x-auto scroll-px-4 px-4 pb-2 [scrollbar-width:none] sm:scroll-px-6 sm:px-6 [&::-webkit-scrollbar]:hidden">
          {photos.map((photo) => (
            <div
              key={photo.src}
              className="aspect-4/5 w-[72%] shrink-0 snap-start overflow-hidden rounded-xl bg-muted sm:w-[38%] lg:w-[28%]"
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
