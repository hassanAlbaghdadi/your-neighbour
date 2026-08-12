"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { Dialog as DialogPrimitive } from "radix-ui";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface GalleryPhoto {
  src: string;
  alt: string;
}

const MOBILE_SIZES = "(min-width: 640px) 38vw, 72vw";
const HERO_SIZES = `(min-width: 1024px) 45vw, ${MOBILE_SIZES}`;
const SINGLE_SIZES = `(min-width: 1024px) 22vw, ${MOBILE_SIZES}`;
const FULL_SIZES = `(min-width: 1024px) 90vw, ${MOBILE_SIZES}`;

// One 2x2 hero + four 1x1 cells fill all 8 cells of a 4-col x 2-row block
// exactly, so the pattern seams cleanly into the next block for any photo
// count — cycled by index like the mobile caption number below, not tied to
// a photo's actual content, since the admin can upload photos in any order.
const BENTO_CELLS = [
  { span: "lg:col-span-2 lg:row-span-2", sizes: HERO_SIZES },
  { span: "lg:col-span-1 lg:row-span-1", sizes: SINGLE_SIZES },
  { span: "lg:col-span-1 lg:row-span-1", sizes: SINGLE_SIZES },
  { span: "lg:col-span-1 lg:row-span-1", sizes: SINGLE_SIZES },
  { span: "lg:col-span-1 lg:row-span-1", sizes: SINGLE_SIZES },
];

// BENTO_CELLS only tiles a 4x2 block cleanly in groups of 5 — a photo count
// that isn't a multiple of 5 leaves a trailing group of 1-4 photos that,
// cycled through the same pattern, stops partway through a block and leaves
// empty grid cells (e.g. 9 photos = one full block + a hero-plus-3 block,
// short one cell). Each of these is hand-fit to tile its own 4x2 area with
// zero leftover, so the grid always ends flush regardless of count.
const REMAINDER_CELLS: Record<number, { span: string; sizes: string }[]> = {
  1: [{ span: "lg:col-span-4 lg:row-span-2", sizes: FULL_SIZES }],
  2: [
    { span: "lg:col-span-2 lg:row-span-2", sizes: HERO_SIZES },
    { span: "lg:col-span-2 lg:row-span-2", sizes: HERO_SIZES },
  ],
  3: [
    { span: "lg:col-span-2 lg:row-span-2", sizes: HERO_SIZES },
    { span: "lg:col-span-1 lg:row-span-2", sizes: SINGLE_SIZES },
    { span: "lg:col-span-1 lg:row-span-2", sizes: SINGLE_SIZES },
  ],
  4: [
    { span: "lg:col-span-2 lg:row-span-1", sizes: HERO_SIZES },
    { span: "lg:col-span-2 lg:row-span-1", sizes: HERO_SIZES },
    { span: "lg:col-span-2 lg:row-span-1", sizes: HERO_SIZES },
    { span: "lg:col-span-2 lg:row-span-1", sizes: HERO_SIZES },
  ],
};

function getBentoCell(index: number, total: number) {
  const completeBlockCount = Math.floor(total / BENTO_CELLS.length) * BENTO_CELLS.length;
  if (index < completeBlockCount) {
    return BENTO_CELLS[index % BENTO_CELLS.length];
  }
  return REMAINDER_CELLS[total - completeBlockCount][index - completeBlockCount];
}

export function PhotoGallery({ photos }: { photos: GalleryPhoto[] }) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  const handleScroll = useCallback(() => {
    const track = trackRef.current;
    if (!track || photos.length === 0) return;
    const cardWidth = track.scrollWidth / photos.length;
    setActiveIndex(Math.round(track.scrollLeft / cardWidth));
  }, [photos.length]);

  if (photos.length === 0) return null;

  return (
    <section className="border-b border-border bg-ivory-50">
      <div className="mx-auto w-full max-w-6xl px-4 pt-14 sm:px-6">
        <p className="text-xs font-semibold tracking-wider text-terracotta-600 uppercase">
          From the kitchen
        </p>
        <h2 className="mt-2 font-heading text-2xl font-semibold text-foreground sm:text-3xl">
          A closer look
        </h2>
      </div>

      {/* Full-bleed, unlike the rest of the page's max-w-6xl column — matches
          the hero's edge-to-edge treatment instead of leaving the photos
          boxed into the same narrow column as the menu text. Below lg: the
          same native scroll-snap filmstrip as before — no JS-driven motion,
          nothing that can jank, touch-pan-x keeps a diagonal swipe from
          fighting the page's own vertical scroll. From lg: the track becomes
          a real CSS grid (overflow-visible, snap disabled) and each figure's
          lg: col/row-span turns it into a bento cell instead of a carousel
          card; auto-rows grows at xl/2xl so cells don't go squat as the
          now-unbounded grid gets wider. */}
      <div
        ref={trackRef}
        onScroll={handleScroll}
        className="mt-8 flex touch-pan-x items-stretch gap-4 overflow-x-auto scroll-px-4 px-4 pb-2 snap-x snap-mandatory [scrollbar-width:none] sm:gap-5 sm:scroll-px-6 sm:px-6 sm:[scrollbar-width:thin] [&::-webkit-scrollbar]:hidden sm:[&::-webkit-scrollbar]:block sm:[&::-webkit-scrollbar]:h-1.5 sm:[&::-webkit-scrollbar-thumb]:rounded-full sm:[&::-webkit-scrollbar-thumb]:bg-terracotta-600/30 sm:[&::-webkit-scrollbar-track]:bg-transparent lg:grid lg:auto-rows-[11rem] lg:grid-cols-4 lg:gap-4 lg:overflow-visible lg:px-8 lg:pb-0 lg:snap-none lg:[scrollbar-width:none] lg:[&::-webkit-scrollbar]:hidden xl:auto-rows-[13rem] xl:px-12 2xl:auto-rows-[15rem] 2xl:px-16"
      >
          {photos.map((photo, index) => {
            const cell = getBentoCell(index, photos.length);
            return (
              <figure
                // Index, not src — the admin-curated gallery list doesn't
                // guarantee distinct image_urls (the same upload can be
                // reused across slots), unlike the deduped auto-fallback.
                key={index}
                className={cn(
                  "w-[72%] shrink-0 snap-start sm:w-[38%] lg:w-auto lg:snap-align-none",
                  cell.span,
                )}
              >
                <button
                  type="button"
                  onClick={() => setLightboxIndex(index)}
                  aria-label={
                    photo.alt
                      ? `View ${photo.alt} full size`
                      : `View photo ${index + 1} full size`
                  }
                  className="group relative aspect-[4/5] w-full overflow-hidden rounded-xl bg-muted motion-safe:transition-[transform,box-shadow] motion-safe:duration-300 motion-safe:ease-out focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50 lg:aspect-auto lg:h-full motion-safe:lg:hover:-translate-y-1 motion-safe:lg:hover:shadow-[0_16px_32px_-12px_rgba(42,33,29,0.18),0_4px_10px_-4px_rgba(42,33,29,0.1)]"
                >
                  <Image
                    src={photo.src}
                    alt={photo.alt}
                    fill
                    sizes={cell.sizes}
                    className="object-cover motion-safe:transition-transform motion-safe:duration-500 motion-safe:ease-out motion-safe:lg:group-hover:scale-105"
                  />
                  {/* Caption-on-hover — desktop only. Mobile keeps the
                      permanent figcaption below, since touch has no hover
                      to reveal this with. */}
                  <span
                    aria-hidden
                    className="pointer-events-none absolute inset-x-0 bottom-0 hidden h-2/3 bg-gradient-to-t from-espresso-900/75 via-espresso-900/15 to-transparent opacity-0 motion-safe:transition-opacity motion-safe:duration-300 motion-safe:lg:group-hover:opacity-100 lg:block"
                  />
                  {photo.alt && (
                    <span className="pointer-events-none absolute bottom-3 left-3 hidden max-w-[calc(100%-1.5rem)] truncate text-xs font-medium text-cream-50 opacity-0 motion-safe:transition-opacity motion-safe:duration-300 motion-safe:lg:group-hover:opacity-100 lg:block">
                      {photo.alt}
                    </span>
                  )}
                </button>
                <figcaption className="mt-2 flex items-baseline gap-1.5 text-xs text-muted-foreground lg:hidden">
                  <span className="font-semibold tracking-wider text-terracotta-600">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  {photo.alt && <span>/ {photo.alt}</span>}
                </figcaption>
              </figure>
            );
          })}
        </div>

      <div className="mx-auto w-full max-w-6xl px-4 pb-14 sm:px-6">
        {photos.length > 1 && (
          <div className="mt-3 lg:hidden">
            <div className="flex items-center justify-center gap-1.5" aria-hidden>
              {photos.map((_, index) => (
                <span
                  key={index}
                  className={cn(
                    "h-1.5 rounded-full motion-safe:transition-all motion-safe:duration-300",
                    index === activeIndex
                      ? "w-4 bg-terracotta-600"
                      : "w-1.5 bg-border",
                  )}
                />
              ))}
            </div>
            <p className="sr-only" aria-live="polite">
              Photo {activeIndex + 1} of {photos.length}
            </p>
          </div>
        )}
      </div>

      <PhotoLightbox
        photos={photos}
        index={lightboxIndex}
        onOpenChange={(open) => !open && setLightboxIndex(null)}
        onNavigate={setLightboxIndex}
      />
    </section>
  );
}

function PhotoLightbox({
  photos,
  index,
  onOpenChange,
  onNavigate,
}: {
  photos: GalleryPhoto[];
  index: number | null;
  onOpenChange: (open: boolean) => void;
  onNavigate: (index: number) => void;
}) {
  const isOpen = index !== null;

  // Keeps the last-open photo rendered while the dialog plays its
  // data-closed:animate-out transition — the index prop goes back to null
  // the instant it closes, but Radix keeps Content mounted a moment longer
  // to finish that animation, so this can't just read `index` directly.
  // Adjusted during render (not an effect) per
  // https://react.dev/learn/you-might-not-need-an-effect#adjusting-some-state-when-a-prop-changes
  const [prevIndex, setPrevIndex] = useState(index);
  const [displayIndex, setDisplayIndex] = useState(index ?? 0);
  if (index !== null && index !== prevIndex) {
    setPrevIndex(index);
    setDisplayIndex(index);
  }

  const goTo = useCallback(
    (next: number) => onNavigate((next + photos.length) % photos.length),
    [onNavigate, photos.length],
  );

  useEffect(() => {
    if (!isOpen) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "ArrowLeft") goTo(displayIndex - 1);
      if (event.key === "ArrowRight") goTo(displayIndex + 1);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isOpen, displayIndex, goTo]);

  const photo = photos[displayIndex];

  return (
    <DialogPrimitive.Root open={isOpen} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-espresso-900/80 data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0" />
        <DialogPrimitive.Content className="fixed top-1/2 left-1/2 z-50 w-[calc(100%-2rem)] max-w-3xl -translate-x-1/2 -translate-y-1/2 outline-none data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0">
          <DialogPrimitive.Title className="sr-only">
            {photo.alt || `Photo ${displayIndex + 1}`}
          </DialogPrimitive.Title>
          <DialogPrimitive.Description className="sr-only">
            Photo {displayIndex + 1} of {photos.length}
            {photos.length > 1 ? ". Use the arrow keys to browse." : ""}
          </DialogPrimitive.Description>

          <div className="relative">
            <div className="relative h-[min(70vh,640px)] w-full overflow-hidden rounded-xl bg-espresso-900">
              <Image
                src={photo.src}
                alt=""
                fill
                sizes="(min-width: 640px) 768px, 100vw"
                className="object-contain"
                priority
              />
            </div>

            {photo.alt && (
              <p className="mt-3 text-center text-sm text-cream-50/90">
                {photo.alt}
              </p>
            )}

            <DialogPrimitive.Close className="absolute -top-3 -right-3 flex size-9 items-center justify-center rounded-full bg-cream-50 text-espresso-900 shadow-lg transition-colors hover:bg-white">
              <X className="size-4" />
              <span className="sr-only">Close</span>
            </DialogPrimitive.Close>

            {photos.length > 1 && (
              <>
                <button
                  type="button"
                  onClick={() => goTo(displayIndex - 1)}
                  className="absolute top-1/2 left-2 flex size-10 -translate-y-1/2 items-center justify-center rounded-full bg-cream-50/90 text-espresso-900 shadow-lg transition-colors hover:bg-white sm:-left-14"
                >
                  <ChevronLeft className="size-5" />
                  <span className="sr-only">Previous photo</span>
                </button>
                <button
                  type="button"
                  onClick={() => goTo(displayIndex + 1)}
                  className="absolute top-1/2 right-2 flex size-10 -translate-y-1/2 items-center justify-center rounded-full bg-cream-50/90 text-espresso-900 shadow-lg transition-colors hover:bg-white sm:-right-14"
                >
                  <ChevronRight className="size-5" />
                  <span className="sr-only">Next photo</span>
                </button>
              </>
            )}
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
