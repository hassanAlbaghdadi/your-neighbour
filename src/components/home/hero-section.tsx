import Link from "next/link";
import { ImageOff } from "lucide-react";
import { Button } from "@/components/ui/button";

interface HeroSectionProps {
  imageUrl: string | null;
  imageAlt: string;
}

export function HeroSection({ imageUrl, imageAlt }: HeroSectionProps) {
  return (
    <section className="border-b border-border bg-ivory-50">
      <div className="mx-auto grid w-full max-w-6xl items-center gap-8 px-4 py-12 sm:px-6 lg:grid-cols-[1fr_1.1fr] lg:gap-14 lg:py-20">
        <div className="order-2 lg:order-1">
          <p className="text-xs font-semibold tracking-wider text-terracotta-600 uppercase">
            Small batch · Made to order
          </p>
          <h1 className="mt-3 font-heading text-4xl font-semibold text-foreground sm:text-5xl">
            Fresh, baked to order
          </h1>
          <p className="mt-4 max-w-md text-base text-muted-foreground sm:text-lg">
            Pre-order your favorites for local pickup — baked fresh the
            morning you pick up.
          </p>
          <Button asChild size="lg" className="mt-7">
            <Link href="#menu">See the menu</Link>
          </Button>
        </div>

        <div className="order-1 aspect-4/3 w-full overflow-hidden rounded-xl bg-muted lg:order-2 lg:aspect-square">
          {imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={imageUrl}
              alt={imageAlt}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full w-full flex-col items-center justify-center gap-1.5 text-muted-foreground">
              <ImageOff className="size-6" />
              <span className="text-xs">No photo yet</span>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
