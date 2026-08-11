import { createClient } from "@/lib/supabase/client";

export type UploadPhotoResult =
  | { success: true; url: string }
  | { success: false; error: string };

export async function uploadPhoto(file: File): Promise<UploadPhotoResult> {
  const supabase = createClient();
  const ext = file.name.split(".").pop();
  const path = `${crypto.randomUUID()}.${ext}`;

  const { error } = await supabase.storage
    .from("product-images")
    .upload(path, file, { upsert: true });
  if (error) {
    return { success: false, error: error.message };
  }

  const {
    data: { publicUrl },
  } = supabase.storage.from("product-images").getPublicUrl(path);
  return { success: true, url: publicUrl };
}
