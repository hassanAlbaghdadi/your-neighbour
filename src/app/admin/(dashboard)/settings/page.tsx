import { getSettings } from "@/lib/services/settings/get-settings";
import { SettingsForm } from "@/components/admin/settings-form";

// Admin-only, low-traffic route — always render fresh rather than relying
// on revalidatePath coverage staying exhaustive as the app grows.
export const dynamic = "force-dynamic";

export default async function AdminSettingsPage() {
  const settings = await getSettings();

  return (
    <div>
      <h1 className="font-heading text-2xl font-semibold text-foreground">
        Settings
      </h1>
      <p className="mt-2 text-muted-foreground">
        Store details, capacity, and pickup availability.
      </p>

      <div className="mt-8">
        <SettingsForm settings={settings} />
      </div>
    </div>
  );
}
