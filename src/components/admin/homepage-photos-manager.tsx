"use client";

import { useState, useTransition } from "react";
import Image from "next/image";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, FieldLabel } from "@/components/ui/field";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { ExistingPhotoPicker } from "@/components/admin/existing-photo-picker";
import { PhotoListItemCard } from "@/components/admin/photo-list-item-card";
import { useExistingPhotos } from "@/lib/hooks/use-existing-photos";
import { usePhotoUpload } from "@/lib/hooks/use-photo-upload";
import {
  setHeroPhotoAction,
  clearHeroPhotoAction,
  addGalleryPhotoAction,
  updateGalleryPhotoAltAction,
  deleteGalleryPhotoAction,
  reorderGalleryPhotosAction,
} from "@/app/actions/homepage-photos";
import type { HomepagePhoto } from "@/lib/services/homepage/get-homepage-photos";

function HeroPhotoEditor({ initialHero }: { initialHero: HomepagePhoto | null }) {
  const [hero, setHero] = useState(initialHero);
  const [altDraft, setAltDraft] = useState(initialHero?.alt_text ?? "");
  const [isPending, startTransition] = useTransition();
  const existingPhotos = useExistingPhotos(true);
  const { uploading, upload } = usePhotoUpload();

  function saveHero(imageUrl: string, altText: string) {
    startTransition(async () => {
      const result = await setHeroPhotoAction(imageUrl, altText || null);
      if (!result.success) {
        toast.error(result.error ?? "Failed to set hero photo.");
        return;
      }
      setHero({
        id: hero?.id ?? "pending",
        section: "hero",
        image_url: imageUrl,
        alt_text: altText || null,
        display_order: 0,
        created_at: hero?.created_at ?? new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
      toast.success("Hero photo updated.");
    });
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = await upload(file);
    if (url) saveHero(url, altDraft);
  }

  function handleClear() {
    startTransition(async () => {
      const result = await clearHeroPhotoAction();
      if (!result.success) {
        toast.error(result.error ?? "Failed to revert hero photo.");
        return;
      }
      setHero(null);
      setAltDraft("");
      toast.success("Reverted to automatic hero photo.");
    });
  }

  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle className="text-lg font-semibold">Hero photo</CardTitle>
        <CardDescription>
          Shown at the top of the homepage. Leave unset and it automatically
          uses the first product photo in your menu.
        </CardDescription>
      </CardHeader>
      <CardContent>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
        <div className="relative aspect-4/3 w-full max-w-56 shrink-0 overflow-hidden rounded-lg bg-muted">
          {hero?.image_url && (
            <Image
              src={hero.image_url}
              alt=""
              fill
              sizes="224px"
              className="object-cover"
            />
          )}
        </div>

        <div className="flex flex-1 flex-col gap-3">
          <Field>
            <FieldLabel htmlFor="hero-alt">Alt text</FieldLabel>
            <Input
              id="hero-alt"
              placeholder="Describe the photo"
              value={altDraft}
              onChange={(e) => setAltDraft(e.target.value)}
              onBlur={() => hero && saveHero(hero.image_url, altDraft)}
              disabled={!hero}
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
              onSelect={(url) => saveHero(url, altDraft)}
            />
            {hero && (
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
      </CardContent>
    </Card>
  );
}

function GalleryPhotosEditor({ initialGallery }: { initialGallery: HomepagePhoto[] }) {
  const [gallery, setGallery] = useState(initialGallery);
  const [, startTransition] = useTransition();
  const existingPhotos = useExistingPhotos(true);
  const { uploading, upload } = usePhotoUpload();

  function addPhoto(imageUrl: string) {
    const displayOrder = gallery.length;
    startTransition(async () => {
      const result = await addGalleryPhotoAction(imageUrl, null, displayOrder);
      if (!result.success || !result.data) {
        toast.error(result.error ?? "Failed to add photo.");
        return;
      }
      setGallery((prev) => [
        ...prev,
        {
          id: result.data!.id,
          section: "gallery",
          image_url: imageUrl,
          alt_text: null,
          display_order: displayOrder,
          created_at: result.data!.createdAt,
          updated_at: result.data!.createdAt,
        },
      ]);
      toast.success("Photo added.");
    });
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = await upload(file);
    if (url) addPhoto(url);
  }

  function handleAltChange(id: string, altText: string) {
    setGallery((prev) =>
      prev.map((p) => (p.id === id ? { ...p, alt_text: altText || null } : p)),
    );
    startTransition(async () => {
      const result = await updateGalleryPhotoAltAction(id, altText || null);
      if (!result.success) {
        toast.error(result.error ?? "Failed to update photo.");
      }
    });
  }

  function handleRemove(id: string) {
    const previous = gallery;
    setGallery((prev) => prev.filter((p) => p.id !== id));
    startTransition(async () => {
      const result = await deleteGalleryPhotoAction(id);
      if (!result.success) {
        setGallery(previous);
        toast.error(result.error ?? "Failed to remove photo.");
      }
    });
  }

  function handleMove(index: number, direction: -1 | 1) {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= gallery.length) return;

    const reordered = [...gallery];
    [reordered[index], reordered[targetIndex]] = [reordered[targetIndex], reordered[index]];
    setGallery(reordered);

    startTransition(async () => {
      const result = await reorderGalleryPhotosAction(reordered.map((p) => p.id));
      if (!result.success) {
        toast.error(result.error ?? "Failed to reorder photos.");
      }
    });
  }

  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle className="text-lg font-semibold">Photo gallery</CardTitle>
        <CardDescription>
          Shown further down the homepage. Leave empty and it automatically
          fills in with your product photos.
        </CardDescription>
      </CardHeader>
      <CardContent>
      <div className="flex flex-col gap-3">
        {gallery.map((photo, index) => (
          <PhotoListItemCard
            key={photo.id}
            imageUrl={photo.image_url}
            altText={photo.alt_text}
            index={index}
            total={gallery.length}
            onMove={handleMove}
            onAltChange={(altText) => handleAltChange(photo.id, altText)}
            onRemove={() => handleRemove(photo.id)}
          />
        ))}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Input
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
          onChange={handleFileChange}
          disabled={uploading}
          className="max-w-56 text-xs"
        />
        <ExistingPhotoPicker photos={existingPhotos} onSelect={addPhoto} />
        {uploading && <p className="text-sm text-muted-foreground">Uploading…</p>}
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        <Plus className="inline size-3" /> Add a photo via upload or from your
        existing product photos.
      </p>
      </CardContent>
    </Card>
  );
}

export function HomepagePhotosManager({
  hero,
  gallery,
}: {
  hero: HomepagePhoto | null;
  gallery: HomepagePhoto[];
}) {
  return (
    <div className="flex flex-col gap-6">
      <HeroPhotoEditor initialHero={hero} />
      <GalleryPhotosEditor initialGallery={gallery} />
    </div>
  );
}
