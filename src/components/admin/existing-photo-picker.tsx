"use client";

import { useState } from "react";
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
      <PopoverContent className="w-64">
        {photos.length === 0 ? (
          <p className="text-sm text-muted-foreground">No photos uploaded yet.</p>
        ) : (
          <div className="grid max-h-64 grid-cols-4 gap-1.5 overflow-y-auto">
            {photos.map((url) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={url}
                src={url}
                alt=""
                className="aspect-square w-full cursor-pointer rounded-md object-cover ring-1 ring-border transition-opacity hover:opacity-75"
                onClick={() => {
                  onSelect(url);
                  setPickerOpen(false);
                }}
              />
            ))}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
