"use client";

import { useState } from "react";
import { toast } from "sonner";
import { uploadPhoto } from "@/lib/supabase/upload-photo";

export function usePhotoUpload() {
  const [uploading, setUploading] = useState(false);

  async function upload(file: File): Promise<string | null> {
    setUploading(true);
    const result = await uploadPhoto(file);
    setUploading(false);

    if (!result.success) {
      toast.error(`Failed to upload image: ${result.error}`);
      return null;
    }
    return result.url;
  }

  return { uploading, upload };
}
