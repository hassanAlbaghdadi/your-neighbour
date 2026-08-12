"use client";

import { useState } from "react";
import Image from "next/image";
import { Images } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export function ExistingPhotoPicker({
  photos,
  onSelect,
  compact,
}: {
  photos: string[];
  onSelect: (url: string) => void;
  compact?: boolean;
}) {
  const [pickerOpen, setPickerOpen] = useState(false);

  return (
    <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" size={compact ? "icon" : "sm"}>
          <Images />
          {!compact && "Choose existing"}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 max-h-(--radix-popover-content-available-height) overflow-y-auto">
        {photos.length === 0 ? (
          <p className="text-sm text-muted-foreground">No photos uploaded yet.</p>
        ) : (
          <div className="grid grid-cols-4 gap-1.5">
            {photos.map((url) => (
              <button
                key={url}
                type="button"
                aria-label="Select photo"
                onClick={() => {
                  onSelect(url);
                  setPickerOpen(false);
                }}
                className="relative aspect-square w-full cursor-pointer overflow-hidden rounded-md ring-1 ring-border outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                <Image
                  src={url}
                  alt=""
                  fill
                  sizes="64px"
                  className="object-cover motion-safe:transition-opacity motion-safe:duration-300 motion-safe:ease-out hover:opacity-75"
                />
              </button>
            ))}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
