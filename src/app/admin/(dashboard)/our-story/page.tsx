import { getStoryPhotos } from "@/lib/services/story/get-story-photos";
import { StoryPhotosManager } from "@/components/admin/story-photos-manager";

export default async function AdminOurStoryPage() {
  const { hero, beat1, beat2, beat3 } = await getStoryPhotos();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold text-foreground">
          Our Story
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Choose the photos shown on the storefront&apos;s Our Story page.
        </p>
      </div>

      <StoryPhotosManager hero={hero} beat1={beat1} beat2={beat2} beat3={beat3} />
    </div>
  );
}
