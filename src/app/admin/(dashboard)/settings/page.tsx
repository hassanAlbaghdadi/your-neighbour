import { getSettings } from "@/lib/services/settings/get-settings";
import { SettingsForm } from "@/components/admin/settings-form";
import { PageHeader } from "@/components/admin/page-header";

export default async function AdminSettingsPage() {
  const settings = await getSettings();

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Settings"
        description="Store details, capacity, and pickup availability."
      />

      <SettingsForm settings={settings} />
    </div>
  );
}
