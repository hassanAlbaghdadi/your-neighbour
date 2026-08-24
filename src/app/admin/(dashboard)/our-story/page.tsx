import { getStoryPhotos } from "@/lib/services/story/get-story-photos";
import { StoryPhotosManager } from "@/components/admin/story-photos-manager";
import { PageHeader } from "@/components/admin/page-header";

export default async function AdminOurStoryPage() {
  const { hero, beat1, beat2, beat3 } = await getStoryPhotos();

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Our Story"
        description="Choose the photos shown on the storefront's Our Story page."
      />

      <StoryPhotosManager hero={hero} beat1={beat1} beat2={beat2} beat3={beat3} />
    </div>
  );
}
