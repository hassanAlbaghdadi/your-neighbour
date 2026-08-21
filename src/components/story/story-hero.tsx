import Image from "next/image";
import { ImageOff } from "lucide-react";

interface StoryHeroProps {
  photo: { src: string; alt: string } | null;
}

export function StoryHero({ photo }: StoryHeroProps) {
  return (
    <section
      id="hero"
      className="grid min-h-[560px] w-full grid-cols-1 bg-espresso-900 lg:h-[80svh] lg:max-h-[820px] lg:grid-cols-2"
    >
      <div className="relative order-1 h-[46vh] min-h-[320px] lg:order-none lg:h-full">
        {photo ? (
          <Image
            src={photo.src}
            alt={photo.alt}
            fill
            priority
            sizes="(min-width: 1024px) 50vw, 100vw"
            className="object-cover"
          />
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 text-cream-50/60">
            <ImageOff className="size-6" />
            <span className="text-xs">No photo yet</span>
          </div>
        )}
      </div>

      <div className="order-2 flex flex-col justify-center px-4 py-12 sm:px-6 sm:py-16 lg:order-none lg:px-12 xl:px-16">
        <p className="text-xs font-semibold tracking-wider text-terracotta-200 uppercase">
          Our story
        </p>
        <h1 className="mt-3 max-w-lg font-heading text-4xl font-semibold text-cream-50 sm:text-5xl">
          It started with one tray, for one neighbour.
        </h1>
        <p className="mt-4 max-w-md text-base text-cream-50/85 sm:text-lg">
          Your Neighbour is Sarah’s kitchen in the North End — no
          storefront, no shelf, just fresh stuffed bread and hot karak tea baked to order for the people down the street.
        </p>
      </div>
    </section>
  );
}
