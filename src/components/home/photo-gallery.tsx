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

// Deliberately NOT the literal rendered width (lg:w-72/xl:w-80/2xl:w-96 on
// the figure below) — `sizes` gets multiplied by the *browser's* DPR to
// pick a srcset candidate, and most desktop monitors report DPR 1, so a
// literal match would fetch a bare 1x image there while phones (almost
// always DPR 2-3) automatically get 2-3x for the same vw-based sizes. This
// pads desktop's values to roughly what a 2x display would need, so a
// plain 1x monitor is still comfortably oversampled instead of getting the
// bare minimum — same idea as the vw branches already get for free from
// phones' higher DPR.
const SIZES =
  "(min-width: 1536px) 768px, (min-width: 1280px) 640px, (min-width: 1024px) 576px, (min-width: 640px) 38vw, 72vw";

interface PhotoGalleryProps {
  photos: GalleryPhoto[];
  eyebrow?: string;
  heading?: string;
}

export function PhotoGallery({
  photos,
  eyebrow = "From the kitchen",
  heading = "A closer look",
}: PhotoGalleryProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  const handleScroll = useCallback(() => {
    const track = trackRef.current;
    if (!track || photos.length === 0) return;
    const cardWidth = track.scrollWidth / photos.length;
    setActiveIndex(Math.round(track.scrollLeft / cardWidth));
  }, [photos.length]);

  // Arrows (lg+) step the same scroll-snap track the browser already
  // drives from touch/trackpad input — almost a full screen at a time
  // (not one card, which turns a 7-photo gallery into 6 clicks), but one
  // card short of the full width so a card is always left peeking at the
  // edge as the cue that there's more.
  const scrollByCards = useCallback((direction: 1 | -1) => {
    const track = trackRef.current;
    if (!track || photos.length === 0) return;
    const cardWidth = track.scrollWidth / photos.length;
    const visibleCount = Math.max(1, Math.round(track.clientWidth / cardWidth));
    const step = cardWidth * Math.max(1, visibleCount - 1);
    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    track.scrollBy({
      left: direction * step,
      behavior: reduceMotion ? "auto" : "smooth",
    });
  }, [photos.length]);

  if (photos.length === 0) return null;

  return (
    <section className="border-b border-border bg-ivory-50">
      <div className="mx-auto w-full max-w-6xl px-4 pt-14 sm:px-6">
        <p className="text-xs font-semibold tracking-wider text-terracotta-600 uppercase">
          {eyebrow}
        </p>
        <h2 className="mt-2 font-heading text-2xl font-semibold text-foreground sm:text-3xl">
          {heading}
        </h2>
      </div>

      {/* Full-bleed, unlike the rest of the page's max-w-6xl column — matches
          the hero's edge-to-edge treatment instead of leaving the photos
          boxed into the same narrow column as the menu text. One native
          scroll-snap filmstrip at every breakpoint — no JS-driven position,
          nothing that can jank. Deliberately NOT touch-action: pan-x — that
          restricts panning to horizontal for the whole touch sequence,
          including on ancestors, so any vertical drag starting on a photo
          (not just this element) couldn't scroll the page at all. Mobile
          browsers already disambiguate horizontal-vs-vertical swipe intent
          natively for a plain overflow-x + scroll-snap track, so no
          touch-action override is needed here. Every card is the same
          4:5 shape and weight; only its rendered width grows at lg/xl/2xl,
          which is also what widens the "peek" of the next card at the edge.
          From lg, the scrollbar is hidden in favor of the arrow buttons
          below, which just call scrollBy on this same track — so mouse
          wheel/trackpad scrolling and the arrows drive the identical
          mechanism, they're never out of sync. */}
      <div
        ref={trackRef}
        onScroll={handleScroll}
        className="mt-8 flex items-stretch gap-4 overflow-x-auto scroll-px-4 px-4 pb-2 snap-x snap-mandatory [scrollbar-width:none] sm:gap-5 sm:scroll-px-6 sm:px-6 sm:[scrollbar-width:thin] [&::-webkit-scrollbar]:hidden sm:[&::-webkit-scrollbar]:block sm:[&::-webkit-scrollbar]:h-1.5 sm:[&::-webkit-scrollbar-thumb]:rounded-full sm:[&::-webkit-scrollbar-thumb]:bg-terracotta-600/30 sm:[&::-webkit-scrollbar-track]:bg-transparent lg:gap-6 lg:scroll-px-8 lg:px-8 lg:[scrollbar-width:none] lg:[&::-webkit-scrollbar]:hidden xl:scroll-px-12 xl:px-12 2xl:scroll-px-16 2xl:px-16"
      >
          {photos.map((photo, index) => (
            <figure
              // Index, not src — the admin-curated gallery list doesn't
              // guarantee distinct image_urls (the same upload can be
              // reused across slots), unlike the deduped auto-fallback.
              key={index}
              className="w-[72%] shrink-0 snap-start sm:w-[38%] lg:w-72 xl:w-80 2xl:w-96"
            >
              <button
                type="button"
                onClick={() => setLightboxIndex(index)}
                aria-label={
                  photo.alt
                    ? `View ${photo.alt} full size`
                    : `View photo ${index + 1} full size`
                }
                className="group relative aspect-[4/5] w-full overflow-hidden rounded-xl bg-muted motion-safe:transition-[transform,box-shadow] motion-safe:duration-300 motion-safe:ease-out focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50 motion-safe:lg:hover:-translate-y-1 motion-safe:lg:hover:shadow-[0_16px_32px_-12px_rgba(42,33,29,0.18),0_4px_10px_-4px_rgba(42,33,29,0.1)]"
              >
                <Image
                  src={photo.src}
                  alt={photo.alt}
                  fill
                  sizes={SIZES}
                  className="object-cover motion-safe:transition-transform motion-safe:duration-500 motion-safe:ease-out motion-safe:lg:group-hover:scale-105"
                />
                {/* Hover darken (lg only, touch has no hover) — just a
                    "this is clickable" cue now. The caption itself is the
                    figcaption below, shown at every breakpoint, so mobile
                    and desktop read as the same design instead of desktop
                    going caption-less until a mouse happens by. */}
                <span
                  aria-hidden
                  className="pointer-events-none absolute inset-x-0 bottom-0 hidden h-1/3 bg-gradient-to-t from-espresso-900/40 to-transparent opacity-0 motion-safe:transition-opacity motion-safe:duration-300 motion-safe:lg:group-hover:opacity-100 lg:block"
                />
              </button>
              <figcaption className="mt-2 flex items-baseline gap-1.5 text-xs text-muted-foreground">
                <span className="font-semibold tracking-wider text-terracotta-600">
                  {String(index + 1).padStart(2, "0")}
                </span>
                {photo.alt && <span>/ {photo.alt}</span>}
              </figcaption>
            </figure>
          ))}
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
        {photos.length > 1 && (
          <div className="mt-6 hidden justify-center gap-2 lg:flex">
            <button
              type="button"
              onClick={() => scrollByCards(-1)}
              disabled={activeIndex <= 0}
              className="flex size-10 items-center justify-center rounded-full bg-cream-50/90 text-espresso-900 shadow-lg transition-colors hover:bg-white disabled:pointer-events-none disabled:opacity-40 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <ChevronLeft className="size-5" />
              <span className="sr-only">Previous photos</span>
            </button>
            <button
              type="button"
              onClick={() => scrollByCards(1)}
              disabled={activeIndex >= photos.length - 1}
              className="flex size-10 items-center justify-center rounded-full bg-cream-50/90 text-espresso-900 shadow-lg transition-colors hover:bg-white disabled:pointer-events-none disabled:opacity-40 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <ChevronRight className="size-5" />
              <span className="sr-only">Next photos</span>
            </button>
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
