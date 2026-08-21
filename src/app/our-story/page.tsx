import { getProducts } from "@/lib/services/products/get-products";
import { resolveProductPhotos } from "@/lib/services/products/resolve-product-photos";
import { getHomepagePhotos } from "@/lib/services/homepage/get-homepage-photos";
import { getStoryPhotos } from "@/lib/services/story/get-story-photos";
import { StoryHero } from "@/components/story/story-hero";
import { NarrativeBeat } from "@/components/story/narrative-beat";
import { PullQuote } from "@/components/story/pull-quote";
import { StoryCta } from "@/components/story/story-cta";

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

      <NarrativeBeat photo={beat1Photo} imagePosition="right" background="cream">
        <p className="font-heading text-xl leading-relaxed text-foreground sm:text-2xl">
          Your Neighbour started the way most good things do — at home, with family, friends, and a lot of baking.
        </p>
        <p className="mt-4 text-base leading-relaxed text-muted-foreground">
          Sarah started baking on weekends because, for her, food has always been a way of showing love.
          It was how she made people feel at home, especially after moving to Canada.
          Before long, family and friends started asking for a pan of their own. Then another. And another.
        </p>
      </NarrativeBeat>

      <NarrativeBeat photo={beat2Photo} imagePosition="left" background="ivory">
        <p className="font-heading text-xl leading-relaxed text-foreground sm:text-2xl">
          There was never a plan to open a bakery.
          Just an oven that kept getting used a little more, and a love for making something from scratch and sharing it with the people around her.
        </p>
        <p className="mt-4 text-base leading-relaxed text-muted-foreground">
          After a lot of convincing, Your Neighbour was born — a small, homegrown bakery with a simple mission: to spread love through food, bring people together, and build connections with our neighbours, local businesses, and communities.
        </p>
      </NarrativeBeat>

      <NarrativeBeat photo={beat3Photo} imagePosition="right" background="cream">
        <p className="font-heading text-xl leading-relaxed text-foreground sm:text-2xl">
          Nothing here comes from a wholesale supplier or a walk-in freezer.
        </p>
        <p className="mt-4 text-base leading-relaxed text-muted-foreground">
          Every order starts with simple ingredients, a little patience, and a whole lot of care — made in the same kitchen where you pick it up.
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
