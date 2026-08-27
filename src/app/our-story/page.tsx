import { getProducts } from "@/lib/services/products/get-products";
import { resolveProductPhotos } from "@/lib/services/products/resolve-product-photos";
import { getHomepagePhotos } from "@/lib/services/homepage/get-homepage-photos";
import { getStoryPhotos } from "@/lib/services/story/get-story-photos";
import { StoryHero } from "@/components/story/story-hero";
import { NarrativeBeat } from "@/components/story/narrative-beat";
import { PullQuote } from "@/components/story/pull-quote";
import { StoryCta } from "@/components/story/story-cta";

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Our Story | Your Neighbour, Halifax",
  description:
    "How Sarah brought her mum's Khaliat El Nahal recipe from Yemen to a home bakery in Halifax's North End — one small batch at a time.",
  alternates: { canonical: "/our-story" },
};

export default async function OurStoryPage() {
  const [products, homepagePhotos, storyPhotos] = await Promise.all([
    getProducts(),
    getHomepagePhotos(),
    getStoryPhotos(),
  ]);

  const [autoHero, autoBeat1, autoBeat2, autoBeat3] = resolveProductPhotos(products);

  const heroPhoto = storyPhotos.hero
    ? { src: storyPhotos.hero.image_url, alt: storyPhotos.hero.alt_text ?? "" }
    : homepagePhotos.hero
      ? { src: homepagePhotos.hero.image_url, alt: homepagePhotos.hero.alt_text ?? "" }
      : (autoHero ?? null);

  const beat1Photo = storyPhotos.beat1
    ? { src: storyPhotos.beat1.image_url, alt: storyPhotos.beat1.alt_text ?? "" }
    : (autoBeat1 ?? null);

  const beat2Photo = storyPhotos.beat2
    ? { src: storyPhotos.beat2.image_url, alt: storyPhotos.beat2.alt_text ?? "" }
    : (autoBeat2 ?? null);

  const beat3Photo = storyPhotos.beat3
    ? { src: storyPhotos.beat3.image_url, alt: storyPhotos.beat3.alt_text ?? "" }
    : (autoBeat3 ?? null);

  return (
    <div className="flex flex-1 flex-col">
      <StoryHero photo={heroPhoto} />

      {/* Each beat now carries a real heading rather than an oversized
          opening sentence doing double duty as one -- the copy this
          replaces gave every beat a distinct title, and previously the
          page's only heading was the h1 in the hero. Body copy runs at one
          weight underneath it, rather than picking one paragraph to render
          large: beat2 below has only one paragraph, and singling out a
          "big" line among 1-2 would have made it look thin next to beats
          with two. */}
      <NarrativeBeat photo={beat1Photo} imagePosition="right" background="cream">
        <h2 className="font-heading text-2xl font-semibold text-foreground sm:text-3xl">
          A recipe passed down
        </h2>
        <p className="mt-4 text-base leading-relaxed text-muted-foreground">
          Sarah grew up helping her mum make Khaliat El Nahal, a Yemeni
          honeycomb bread filled with cream cheese and finished with syrup.
          It was the kind of food that brought everyone to the table — and a
          recipe that became part of her childhood.
        </p>
      </NarrativeBeat>

      <NarrativeBeat photo={beat2Photo} imagePosition="left" background="ivory">
        <h2 className="font-heading text-2xl font-semibold text-foreground sm:text-3xl">
          A little piece of home
        </h2>
        <p className="mt-4 text-base leading-relaxed text-muted-foreground">
          When Sarah moved to Canada, she found herself missing it deeply.
          So she kept making it — again and again — until she perfected the
          recipe.
        </p>
      </NarrativeBeat>

      <NarrativeBeat photo={beat3Photo} imagePosition="right" background="cream">
        <h2 className="font-heading text-2xl font-semibold text-foreground sm:text-3xl">
          From our home to yours
        </h2>
        <p className="mt-4 text-base leading-relaxed text-muted-foreground">
          Our food is a reflection of where Sarah comes from. The honeycomb
          bread comes from her Yemeni roots, while our Karak tea is made with
          Kenyan tea leaves, a nod to the other side of her family and the
          tea she grew up with.
        </p>
        <p className="mt-4 text-base leading-relaxed text-muted-foreground">
          What started as something Sarah made for herself, then for family
          and friends, eventually became Your Neighbour — a small home
          bakery.
        </p>
      </NarrativeBeat>

      <PullQuote
        quote="I bake the way I’d bake for my family and friends — like it’s going to someone I actually know. Most days, it is."
        attribution="Sarah, Your Neighbour"
      />

      <StoryCta />
    </div>
  );
}
