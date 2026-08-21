"use client";

import { useState, useTransition } from "react";
import Image from "next/image";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, FieldLabel } from "@/components/ui/field";
import { ExistingPhotoPicker } from "@/components/admin/existing-photo-picker";
import { useExistingPhotos } from "@/lib/hooks/use-existing-photos";
import { usePhotoUpload } from "@/lib/hooks/use-photo-upload";
import {
  setStorySinglePhotoAction,
  clearStorySinglePhotoAction,
} from "@/app/actions/story-photos";
import type { StorySingleSection } from "@/lib/services/story/manage-story-photos";
import type { StoryPhoto } from "@/lib/services/story/get-story-photos";

function SinglePhotoEditor({
  section,
  title,
  description,
  initialPhoto,
}: {
  section: StorySingleSection;
  title: string;
  description: string;
  initialPhoto: StoryPhoto | null;
}) {
  const [photo, setPhoto] = useState(initialPhoto);
  const [altDraft, setAltDraft] = useState(initialPhoto?.alt_text ?? "");
  const [isPending, startTransition] = useTransition();
  const existingPhotos = useExistingPhotos(true);
  const { uploading, upload } = usePhotoUpload();

  function save(imageUrl: string, altText: string) {
    startTransition(async () => {
      const result = await setStorySinglePhotoAction(section, imageUrl, altText || null);
      if (!result.success) {
        toast.error(result.error ?? "Failed to set photo.");
        return;
      }
      setPhoto({
        id: photo?.id ?? "pending",
        section,
        image_url: imageUrl,
        alt_text: altText || null,
        display_order: 0,
        created_at: photo?.created_at ?? new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
      toast.success("Photo updated.");
    });
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = await upload(file);
    if (url) save(url, altDraft);
  }

  function handleClear() {
    startTransition(async () => {
      const result = await clearStorySinglePhotoAction(section);
      if (!result.success) {
        toast.error(result.error ?? "Failed to revert photo.");
        return;
      }
      setPhoto(null);
      setAltDraft("");
      toast.success("Reverted to automatic photo.");
    });
  }

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <h3 className="font-heading text-lg font-semibold text-foreground">{title}</h3>
      <p className="mt-1 text-sm text-muted-foreground">{description}</p>

      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-start">
        <div className="relative aspect-4/3 w-full max-w-56 shrink-0 overflow-hidden rounded-lg bg-muted">
          {photo?.image_url && (
            <Image
              src={photo.image_url}
              alt=""
              fill
              sizes="224px"
              className="object-cover"
            />
          )}
        </div>

        <div className="flex flex-1 flex-col gap-3">
          <Field>
            <FieldLabel htmlFor={`${section}-alt`}>Alt text</FieldLabel>
            <Input
              id={`${section}-alt`}
              placeholder="Describe the photo"
              value={altDraft}
              onChange={(e) => setAltDraft(e.target.value)}
              onBlur={() => photo && save(photo.image_url, altDraft)}
              disabled={!photo}
            />
          </Field>

          <div className="flex flex-wrap items-center gap-2">
            <Input
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              onChange={handleFileChange}
              disabled={uploading || isPending}
              className="max-w-56 text-xs"
            />
            <ExistingPhotoPicker
              photos={existingPhotos}
              onSelect={(url) => save(url, altDraft)}
            />
            {photo && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleClear}
                disabled={isPending}
              >
                Revert to automatic
              </Button>
            )}
          </div>
          {uploading && <p className="text-sm text-muted-foreground">Uploading…</p>}
        </div>
      </div>
    </div>
  );
}

export function StoryPhotosManager({
  hero,
  beat1,
  beat2,
  beat3,
}: {
  hero: StoryPhoto | null;
  beat1: StoryPhoto | null;
  beat2: StoryPhoto | null;
  beat3: StoryPhoto | null;
}) {
  return (
    <div className="flex flex-col gap-6">
      <SinglePhotoEditor
        section="story_hero"
        title="Hero photo"
        description="The split hero at the top of Our Story. Leave unset and it automatically uses the homepage hero photo."
        initialPhoto={hero}
      />
      <SinglePhotoEditor
        section="story_beat_1"
        title="First narrative photo"
        description="Paired with the first part of the origin story. Leave unset and it automatically uses a product photo."
        initialPhoto={beat1}
      />
      <SinglePhotoEditor
        section="story_beat_2"
        title="Second narrative photo"
        description="Paired with the second part of the origin story. Leave unset and it automatically uses a product photo."
        initialPhoto={beat2}
      />
      <SinglePhotoEditor
        section="story_beat_3"
        title="Third narrative photo"
        description="Paired with the 'made in-house, not from a supplier' section. Leave unset and it automatically uses a product photo."
        initialPhoto={beat3}
      />
    </div>
  );
}
