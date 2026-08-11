import { getHomepagePhotos } from "@/lib/services/homepage/get-homepage-photos";
import { HomepagePhotosManager } from "@/components/admin/homepage-photos-manager";

export default async function AdminHomepagePage() {
  const { hero, gallery } = await getHomepagePhotos();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold text-foreground">
          Homepage
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Choose the photos shown on the storefront homepage.
        </p>
      </div>

      <HomepagePhotosManager hero={hero} gallery={gallery} />
    </div>
  );
}
