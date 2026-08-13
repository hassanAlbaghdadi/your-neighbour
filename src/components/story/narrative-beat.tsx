"use client";

import Image from "next/image";
import { ImageOff } from "lucide-react";
import { cn } from "@/lib/utils";
import { useScrollReveal } from "@/lib/hooks/use-scroll-reveal";

interface NarrativeBeatProps {
  photo: { src: string; alt: string } | null;
  imagePosition: "left" | "right";
  background?: "cream" | "ivory";
  children: React.ReactNode;
}

export function NarrativeBeat({
  photo,
  imagePosition,
  background = "cream",
  children,
}: NarrativeBeatProps) {
  const { ref, visible } = useScrollReveal<HTMLElement>();

  return (
    <section
      ref={ref}
      className={cn(
        "border-b border-border",
        background === "cream" ? "bg-cream-50" : "bg-ivory-50",
      )}
    >
      <div className="mx-auto grid w-full max-w-6xl grid-cols-1 items-center gap-8 px-4 py-14 sm:px-6 sm:py-20 lg:grid-cols-2 lg:gap-16">
        <div
          className={cn(
            "relative aspect-[4/5] w-full overflow-hidden rounded-xl bg-muted motion-safe:transition-all motion-safe:duration-700 motion-safe:ease-out",
            imagePosition === "right" && "lg:order-2",
            visible
              ? "opacity-100 translate-y-0"
              : "motion-safe:translate-y-6 motion-safe:opacity-0",
          )}
        >
          {photo ? (
            <Image
              src={photo.src}
              alt={photo.alt}
              fill
              sizes="(min-width: 1024px) 48vw, 100vw"
              className="object-cover"
            />
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 text-muted-foreground">
              <ImageOff className="size-6" />
              <span className="text-xs">No photo yet</span>
            </div>
          )}
        </div>

        <div
          className={cn(
            "max-w-xl motion-safe:transition-all motion-safe:duration-700 motion-safe:ease-out motion-safe:delay-150",
            imagePosition === "right" && "lg:order-1",
            visible
              ? "opacity-100 translate-y-0"
              : "motion-safe:translate-y-6 motion-safe:opacity-0",
          )}
        >
          {children}
        </div>
      </div>
    </section>
  );
}
