import { getProducts } from "@/lib/services/products/get-products";
import { resolveProductPhotos } from "@/lib/services/products/resolve-product-photos";
import { getSettings } from "@/lib/services/settings/get-settings";
import { getHomepagePhotos } from "@/lib/services/homepage/get-homepage-photos";
import { getStoryPhotos } from "@/lib/services/story/get-story-photos";
import { StoryHero } from "@/components/story/story-hero";
import { NarrativeBeat } from "@/components/story/narrative-beat";
import { PullQuote } from "@/components/story/pull-quote";
import { StoryFacts } from "@/components/home/story-facts";
import { DayInTheLife, type TimelineStep } from "@/components/story/day-in-the-life";
import { PhotoGallery } from "@/components/home/photo-gallery";
import { StoryCta } from "@/components/story/story-cta";

const TIMELINE_COPY: Omit<TimelineStep, "photo">[] = [
  {
    time: "4:00 AM",
    title: "Flour & water",
    description:
      "The first mix of the day, timed against whichever orders need the longest proof.",
  },
  {
    time: "7:30 AM",
    title: "Shape & proof",
    description:
      "Loaves and pastries take their final shape and rest until they're ready for the oven.",
  },
  {
    time: "9:00 AM",
    title: "Into the oven",
    description:
      "Everything bakes in small batches — never more trays than can be watched at once.",
  },
  {
    time: "10:30 AM",
    title: "Ready for pickup",
    description: "Boxed up warm and waiting at the door for whoever ordered it.",
  },
];

export default async function OurStoryPage() {
  const [products, settings, homepagePhotos, storyPhotos] = await Promise.all([
    getProducts(),
    getSettings(),
    getHomepagePhotos(),
    getStoryPhotos(),
  ]);

  const [autoHero, autoBeat1, autoBeat2, ...autoRest] = resolveProductPhotos(products);
  const autoTimeline = autoRest.slice(0, 4);
  const autoGallery = autoRest.slice(4);

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

  const timelinePhotoPool =
    storyPhotos.timeline.length > 0
      ? storyPhotos.timeline.map((p) => ({ src: p.image_url, alt: p.alt_text ?? "" }))
      : autoTimeline;

  const timelineSteps: TimelineStep[] = TIMELINE_COPY.map((copy, index) => ({
    ...copy,
    photo:
      timelinePhotoPool.length > 0
        ? timelinePhotoPool[index % timelinePhotoPool.length]
        : null,
  }));

  const galleryPhotos =
    storyPhotos.gallery.length > 0
      ? storyPhotos.gallery.map((p) => ({ src: p.image_url, alt: p.alt_text ?? "" }))
      : autoGallery;

  return (
    <div className="flex flex-1 flex-col">
      <StoryHero photo={heroPhoto} />

      <NarrativeBeat photo={beat1Photo} imagePosition="right" background="cream">
        <p className="font-heading text-xl leading-relaxed text-foreground sm:text-2xl">
          Sarah started baking the way most people do — for family, on
          weekends, because it was the best part of the week.
        </p>
        <p className="mt-4 text-base leading-relaxed text-muted-foreground">
          Neighbours started asking for a loaf of their own. Then two. Then
          a standing order.
        </p>
      </NarrativeBeat>

      <NarrativeBeat photo={beat2Photo} imagePosition="left" background="ivory">
        <p className="font-heading text-xl leading-relaxed text-foreground sm:text-2xl">
          There was never a plan to open a shop — just an oven that kept
          getting used a little more, until baking to order became the
          whole thing.
        </p>
        <p className="mt-4 text-base leading-relaxed text-muted-foreground">
          Nothing here comes from a wholesale supplier or a walk-in
          freezer. Every order starts as flour, water, and time, mixed in
          the same kitchen it&apos;s picked up from.
        </p>
      </NarrativeBeat>

      <PullQuote
        quote="I bake the way I'd want to be baked for — like it's going to someone I actually know. Most days, it is."
        attribution="Sarah, Your Neighbour"
      />

      <StoryFacts minAdvanceHours={settings.minAdvanceHours} />

      <DayInTheLife steps={timelineSteps} />

      <PhotoGallery
        photos={galleryPhotos}
        eyebrow="Behind the counter"
        heading="One more look inside"
      />

      <StoryCta />
    </div>
  );
}
