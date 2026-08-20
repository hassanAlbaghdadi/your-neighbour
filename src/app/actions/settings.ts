"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { settingsSchema } from "@/lib/validations/settings";
import { updateSettings } from "@/lib/services/settings/update-settings";
import type { ActionResult } from "@/types/action-result";

export async function updateSettingsAction(
  payload: unknown,
): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { success: false, error: "Unauthorized" };
  }

  const parsed = settingsSchema.safeParse(payload);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Invalid settings.",
    };
  }

  try {
    await updateSettings(parsed.data);
    revalidatePath("/admin/settings");
    revalidatePath("/checkout");
    return { success: true };
  } catch (error) {
    console.error("updateSettingsAction failed:", error);
    return { success: false, error: "Failed to save settings." };
  }
}
