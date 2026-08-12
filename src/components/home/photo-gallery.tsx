import { cn } from "@/lib/utils";

interface GalleryPhoto {
  src: string;
  alt: string;
}

// Cycled by index for a proof-sheet rhythm (portrait/square/landscape)
// instead of a uniform product grid — deliberately not tied to each photo's
// actual content, since the admin can upload photos in any order.
const FRAME_ASPECTS = ["aspect-[4/5]", "aspect-square", "aspect-[3/2]"];

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

        {/* Native scroll-snap only — no JS-driven motion, nothing that can
            jank. touch-pan-x keeps a diagonal swipe from being fought over
            between this strip and the page's own vertical scroll. Frames
            bottom-align (each keeps its own aspect ratio, so heights vary)
            rather than stretching to a shared height — a stable baseline
            reads as an intentional proof sheet; top-aligning the same
            variance instead scatters several differently-sized rectangles
            and their captions across the row, which reads as broken
            alignment once more than 2 are visible side by side.

            Scrollbar is hidden below sm: — touch swipe covers it there — but
            shown (thin, muted) from sm: up: a mouse has no swipe gesture and
            wheel scroll is vertical-only by default, so without a visible
            drag handle a desktop pointer user has no way to move this at
            all. */}
        <div className="mt-8 flex touch-pan-x items-end gap-6 overflow-x-auto scroll-px-4 px-4 pb-2 snap-x snap-mandatory [scrollbar-width:none] sm:gap-8 sm:scroll-px-6 sm:px-6 sm:[scrollbar-width:thin] [&::-webkit-scrollbar]:hidden sm:[&::-webkit-scrollbar]:block sm:[&::-webkit-scrollbar]:h-1.5 sm:[&::-webkit-scrollbar-thumb]:rounded-full sm:[&::-webkit-scrollbar-thumb]:bg-terracotta-600/30 sm:[&::-webkit-scrollbar-track]:bg-transparent">
          {photos.map((photo, index) => (
            <figure
              key={photo.src}
              className="w-[72%] shrink-0 snap-start sm:w-[38%] lg:w-[28%]"
            >
              <div
                className={cn(
                  "overflow-hidden rounded-xl bg-muted",
                  FRAME_ASPECTS[index % FRAME_ASPECTS.length],
                )}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={photo.src}
                  alt={photo.alt}
                  className="h-full w-full object-cover"
                />
              </div>
              <figcaption className="mt-2 flex items-baseline gap-1.5 text-xs text-muted-foreground">
                <span className="font-semibold tracking-wider text-terracotta-600">
                  {String(index + 1).padStart(2, "0")}
                </span>
                {photo.alt && <span>/ {photo.alt}</span>}
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}
