"use client";

import dynamic from "next/dynamic";
import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useMediaQuery, BELOW_SM } from "@/lib/hooks/use-media-query";
import type { DateStatus } from "@/lib/checkout/pickup-availability";

// react-day-picker only ever renders inside a closed-by-default overlay, so
// it's loaded on demand instead of bundled into checkout's initial JS chunk.
const Calendar = dynamic(
  () => import("@/components/ui/calendar").then((mod) => mod.Calendar),
  {
    ssr: false,
    loading: () => (
      <p className="p-4 text-sm text-muted-foreground">Loading calendar…</p>
    ),
  },
);

interface PickupDatePickerProps {
  selectedDate: Date | undefined;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (date: Date | undefined) => void;
  statusFor: (date: Date) => DateStatus;
  /** The first month with anything selectable in it. */
  earliestAvailable: Date | null;
  invalid: boolean;
  describedBy?: string;
}

/**
 * The pickup-date control.
 *
 * Two things drive the shape here. First, on a phone the plain Popover put a
 * 212px floating card at x=82 on a 375px screen, with no scrim, over the
 * form's own error text — so below `sm` this is a bottom sheet instead, which
 * is what every native date picker does and what gives the 44px grid room to
 * exist. Second, every unavailable day used to render as identical grey: too
 * soon, blacked out and fully booked were indistinguishable, so a customer
 * whose birthday was greyed out had no way to tell a rule from a bug. "Full"
 * is called out with a strikethrough rather than a paragraph of legend —
 * the "Earliest pickup is ..." hint under the trigger already accounts for
 * the common case, and a block of explanatory text inside a `w-auto`
 * popover stretched the desktop calendar to two and a half times its own
 * width.
 */
export function PickupDatePicker({
  selectedDate,
  open,
  onOpenChange,
  onSelect,
  statusFor,
  earliestAvailable,
  invalid,
  describedBy,
}: PickupDatePickerProps) {
  const isMobile = useMediaQuery(BELOW_SM);

  // A function rather than a shared element: the desktop branch hands it to
  // PopoverTrigger's `asChild`, which needs to attach its own handlers and
  // ref, while the mobile branch opens the sheet itself.
  const renderTrigger = (extra?: { onClick: () => void }) => (
    <Button
      id="pickup-date"
      type="button"
      variant="outline"
      // text-base to match the inputs below it. At text-sm this was the one
      // control in the form rendering at a different size from its
      // neighbours, which read as a different kind of thing.
      className="justify-start border-input text-base font-normal"
      aria-invalid={invalid}
      aria-describedby={describedBy}
      {...extra}
    >
      <CalendarIcon />
      {selectedDate ? format(selectedDate, "PPP") : "Choose a date"}
    </Button>
  );

  const calendar = (
    <Calendar
      mode="single"
      selected={selectedDate}
      onSelect={onSelect}
      disabled={(date) => statusFor(date) !== "available"}
      // Opens on the first month that has something in it. With a 48-hour
      // lead time near the end of a month, the current month can be entirely
      // dead — four rows of grey and nothing to tap.
      defaultMonth={earliestAvailable ?? undefined}
      startMonth={earliestAvailable ?? undefined}
      modifiers={{ full: (date) => statusFor(date) === "full" }}
      modifiersClassNames={{ full: "line-through decoration-2" }}
      autoFocus
    />
  );

  if (isMobile) {
    return (
      <>
        {renderTrigger({ onClick: () => onOpenChange(true) })}
        <Sheet open={open} onOpenChange={onOpenChange}>
          <SheetContent
            side="bottom"
            // max() rather than the bare env(): the safe-area inset is 0 on
            // most devices, which left the last row of days flush against
            // the bottom edge of the screen.
            className="max-h-[85svh] overflow-y-auto pb-[max(1rem,env(safe-area-inset-bottom))]"
          >
            <SheetHeader>
              <SheetTitle>Choose a pickup date</SheetTitle>
            </SheetHeader>
            <div className="flex justify-center px-2">{calendar}</div>
          </SheetContent>
        </Sheet>
      </>
    );
  }

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>{renderTrigger()}</PopoverTrigger>
      <PopoverContent className="w-auto p-0">{calendar}</PopoverContent>
    </Popover>
  );
}
