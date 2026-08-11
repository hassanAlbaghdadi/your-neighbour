"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export function useExistingPhotos(enabled: boolean) {
  const [photos, setPhotos] = useState<string[]>([]);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;

    async function loadExistingPhotos() {
      const supabase = createClient();
      const { data, error } = await supabase.storage
        .from("product-images")
        .list("", { limit: 100, sortBy: { column: "created_at", order: "desc" } });
      if (error || !data || cancelled) return;

      const seen = new Set<string>();
      const urls: string[] = [];
      for (const file of data) {
        const eTag = (file.metadata as { eTag?: string } | null)?.eTag;
        const dedupeKey = eTag ?? file.name;
        if (seen.has(dedupeKey)) continue;
        seen.add(dedupeKey);
        const {
          data: { publicUrl },
        } = supabase.storage.from("product-images").getPublicUrl(file.name);
        urls.push(publicUrl);
      }
      if (!cancelled) setPhotos(urls);
    }

    loadExistingPhotos();
    return () => {
      cancelled = true;
    };
  }, [enabled]);

  return photos;
}
