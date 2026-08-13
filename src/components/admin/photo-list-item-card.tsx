"use client";

import { useState } from "react";
import Image from "next/image";
import { ArrowDown, ArrowUp, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function PhotoListItemCard({
  imageUrl,
  altText,
  index,
  total,
  onMove,
  onAltChange,
  onRemove,
}: {
  imageUrl: string;
  altText: string | null;
  index: number;
  total: number;
  onMove: (index: number, direction: -1 | 1) => void;
  onAltChange: (altText: string) => void;
  onRemove: () => void;
}) {
  const [altDraft, setAltDraft] = useState(altText ?? "");

  return (
    <div className="flex items-start gap-3 rounded-lg border border-border p-3">
      <div className="relative size-16 shrink-0 overflow-hidden rounded-md bg-muted">
        <Image src={imageUrl} alt="" fill sizes="64px" className="object-cover" />
      </div>

      <div className="flex-1">
        <Input
          placeholder="Describe the photo"
          value={altDraft}
          onChange={(e) => setAltDraft(e.target.value)}
          onBlur={() => onAltChange(altDraft)}
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
          onClick={onRemove}
          aria-label="Remove photo"
        >
          <X />
        </Button>
      </div>
    </div>
  );
}
