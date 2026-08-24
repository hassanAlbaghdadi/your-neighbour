import { ExternalLink } from "lucide-react";
import { getHomepagePhotos } from "@/lib/services/homepage/get-homepage-photos";
import { HomepagePhotosManager } from "@/components/admin/homepage-photos-manager";
import { PageHeader } from "@/components/admin/page-header";
import { Button } from "@/components/ui/button";

export default async function AdminHomepagePage() {
  const { hero, gallery } = await getHomepagePhotos();

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Homepage"
        description="Choose the photos shown on the storefront homepage."
        action={
          <Button variant="outline" size="sm" asChild>
            <a href="/" target="_blank" rel="noopener noreferrer">
              View live site <ExternalLink />
            </a>
          </Button>
        }
      />

      <HomepagePhotosManager hero={hero} gallery={gallery} />
    </div>
  );
}
