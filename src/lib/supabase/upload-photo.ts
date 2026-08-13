import { createClient } from "@/lib/supabase/client";
import { compressPhoto } from "@/lib/image/compress-photo";

export type UploadPhotoResult =
  | { success: true; url: string }
  | { success: false; error: string };

const MAX_RAW_BYTES = 25 * 1024 * 1024;
const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;

export async function uploadPhoto(file: File): Promise<UploadPhotoResult> {
  if (!file.type.startsWith("image/")) {
    return { success: false, error: "Only image files are allowed." };
  }
  if (file.size > MAX_RAW_BYTES) {
    return { success: false, error: "Image is too large — max 25MB." };
  }

  const compressed = await compressPhoto(file, MAX_UPLOAD_BYTES);
  if (compressed.size > MAX_UPLOAD_BYTES) {
    return { success: false, error: "Image is too large — max 8MB after compression." };
  }

  const supabase = createClient();
  const ext = compressed.name.split(".").pop();
  const path = `${crypto.randomUUID()}.${ext}`;

  const { error } = await supabase.storage
    .from("product-images")
    .upload(path, compressed, { upsert: true });
  if (error) {
    return { success: false, error: error.message };
  }

  const {
    data: { publicUrl },
  } = supabase.storage.from("product-images").getPublicUrl(path);
  return { success: true, url: publicUrl };
}
