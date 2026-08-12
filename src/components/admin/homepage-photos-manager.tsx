"use client";

import { useState, useTransition } from "react";
import Image from "next/image";
import { toast } from "sonner";
import { ArrowDown, ArrowUp, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, FieldLabel } from "@/components/ui/field";
import { ExistingPhotoPicker } from "@/components/admin/existing-photo-picker";
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
    <div className="rounded-xl border border-border bg-card p-4">
      <h3 className="font-heading text-lg font-semibold text-foreground">Hero photo</h3>
      <p className="mt-1 text-sm text-muted-foreground">
        Shown at the top of the homepage. Leave unset and it automatically
        uses the first product photo in your menu.
      </p>

      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-start">
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
    </div>
  );
}

function GalleryPhotoCard({
  photo,
  index,
  total,
  onMove,
  onAltChange,
  onRemove,
}: {
  photo: HomepagePhoto;
  index: number;
  total: number;
  onMove: (index: number, direction: -1 | 1) => void;
  onAltChange: (id: string, altText: string) => void;
  onRemove: (id: string) => void;
}) {
  const [altDraft, setAltDraft] = useState(photo.alt_text ?? "");

  return (
    <div className="flex items-start gap-3 rounded-lg border border-border p-3">
      <div className="relative size-16 shrink-0 overflow-hidden rounded-md bg-muted">
        <Image src={photo.image_url} alt="" fill sizes="64px" className="object-cover" />
      </div>

      <div className="flex-1">
        <Input
          placeholder="Describe the photo"
          value={altDraft}
          onChange={(e) => setAltDraft(e.target.value)}
          onBlur={() => onAltChange(photo.id, altDraft)}
          className="text-sm"
        />
      </div>

      <div className="flex items-center gap-1">
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          disabled={index === 0}
          onClick={() => onMove(index, -1)}
          aria-label="Move photo earlier"
        >
          <ArrowUp />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          disabled={index === total - 1}
          onClick={() => onMove(index, 1)}
          aria-label="Move photo later"
        >
          <ArrowDown />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          onClick={() => onRemove(photo.id)}
          aria-label="Remove photo"
        >
          <X />
        </Button>
      </div>
    </div>
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
    <div className="rounded-xl border border-border bg-card p-4">
      <h3 className="font-heading text-lg font-semibold text-foreground">Photo gallery</h3>
      <p className="mt-1 text-sm text-muted-foreground">
        Shown further down the homepage. Leave empty and it automatically
        fills in with your product photos.
      </p>

      <div className="mt-4 flex flex-col gap-3">
        {gallery.map((photo, index) => (
          <GalleryPhotoCard
            key={photo.id}
            photo={photo}
            index={index}
            total={gallery.length}
            onMove={handleMove}
            onAltChange={handleAltChange}
            onRemove={handleRemove}
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
    </div>
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
