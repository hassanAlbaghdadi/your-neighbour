import { createClient } from "@/lib/supabase/client";

export type UploadPhotoResult =
  | { success: true; url: string }
  | { success: false; error: string };

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;

export async function uploadPhoto(file: File): Promise<UploadPhotoResult> {
  if (!file.type.startsWith("image/")) {
    return { success: false, error: "Only image files are allowed." };
  }
  if (file.size > MAX_FILE_SIZE_BYTES) {
    return { success: false, error: "Image is too large — max 5MB." };
  }

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
