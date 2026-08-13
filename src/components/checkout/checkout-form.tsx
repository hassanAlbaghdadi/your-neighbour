"use client";

import { useMemo, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { format, isBefore, startOfDay } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { useCart } from "@/context/cart-context";
import { createOrderAction } from "@/app/actions/orders";
import { formatPrice } from "@/lib/utils";
import {
  checkoutFormSchema,
  type CheckoutFormValues,
} from "@/lib/validations/order";
import type { StoreSettings } from "@/lib/services/settings/get-settings";

// react-day-picker only ever renders inside a closed-by-default Popover, so
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

// Screen order, which is what "the first thing to fix" means to a customer
// — not the schema's key order.
const FIELD_FOCUS_ORDER = [
  "pickupDate",
  "pickupTime",
  "customerName",
  "customerEmail",
  "customerPhone",
  "notes",
] as const satisfies readonly (keyof CheckoutFormValues)[];

interface CheckoutFormProps {
  settings: StoreSettings;
  orderCounts: Record<string, number>;
}

export function CheckoutForm({ settings, orderCounts }: CheckoutFormProps) {
  const router = useRouter();
  const { items, subtotal, clearCart } = useCart();
  const [selectedDate, setSelectedDate] = useState<Date | undefined>();
  const [dateOpen, setDateOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  // Guards re-entrancy synchronously — set and cleared entirely inside
  // handleFormSubmit below, never in onSubmit. See the comment there.
  const submittingRef = useRef(false);

  // Captured once at mount via a lazy initializer rather than useMemo:
  // Date.now() is an impure read, and useMemo's factory still runs during
  // render, so React Compiler flags it. A one-time snapshot is also the
  // correct behavior here — minAdvanceHours doesn't change mid-checkout.
  const [minAllowed] = useState(
    () => new Date(Date.now() + settings.minAdvanceHours * 60 * 60 * 1000),
  );

  // Same lazy-initializer pattern as minAllowed above: captured once at mount
  // so every submit attempt (including a double-submit) reuses the same id,
  // letting the server-side idempotency check actually catch duplicates.
  const [orderId] = useState(() => crypto.randomUUID());

  // Used by focusFirstError below. The date trigger needs no equivalent ref:
  // it renders through PopoverTrigger's `asChild`, which claims the child's
  // ref for Radix's own use, so one passed to <Button> never reaches the DOM
  // node — it's looked up by the id it already carries for its label.
  const pickupTimeGroupRef = useRef<HTMLDivElement>(null);

  const {
    register,
    handleSubmit,
    setValue,
    control,
    formState: { errors },
  } = useForm<CheckoutFormValues>({
    resolver: zodResolver(checkoutFormSchema),
    // Focus is handled in focusFirstError below instead. react-hook-form
    // can only focus fields it registered, so on a form whose first two
    // fields are a popover trigger and a button group it reliably lands on
    // the wrong one — and it runs its focus after the invalid callback, so
    // it wins any attempt to correct it afterwards. Owning this outright is
    // simpler than racing it.
    shouldFocusError: false,
    defaultValues: {
      customerName: "",
      customerEmail: "",
      customerPhone: "",
      pickupDate: "",
      pickupTime: "",
      notes: "",
    },
  });

  const pickupTime = useWatch({ control, name: "pickupTime" });

  function isDateDisabled(date: Date) {
    if (isBefore(date, startOfDay(new Date()))) return true;
    const dateStr = format(date, "yyyy-MM-dd");
    if (settings.blackoutDates.includes(dateStr)) return true;
    if ((orderCounts[dateStr] ?? 0) >= settings.maxOrdersPerDay) return true;
    const hasValidSlot = settings.pickupTimeSlots.some(
      (slot) => new Date(`${dateStr}T${slot}:00`) >= minAllowed,
    );
    return !hasValidSlot;
  }

  const availableSlots = useMemo(() => {
    if (!selectedDate) return [];
    const dateStr = format(selectedDate, "yyyy-MM-dd");
    return settings.pickupTimeSlots.filter(
      (slot) => new Date(`${dateStr}T${slot}:00`) >= minAllowed,
    );
  }, [selectedDate, settings.pickupTimeSlots, minAllowed]);

  function handleDateSelect(date: Date | undefined) {
    setSelectedDate(date);
    setValue("pickupDate", date ? format(date, "yyyy-MM-dd") : "");
    setValue("pickupTime", "");
    // Closing on select (rather than leaving it open until an outside
    // click) matters here specifically: the pickup-time buttons render
    // directly below the trigger, in the same screen area the still-open
    // popover occupies, so a click aimed at a time slot right after picking
    // a date was landing on the popover instead of the button underneath it.
    setDateOpen(false);
  }

  async function onSubmit(values: CheckoutFormValues) {
    if (items.length === 0) return;

    const payload = {
      id: orderId,
      ...values,
      items: items.map((item) => ({
        variantId: item.variantId,
        quantity: item.quantity,
      })),
    };

    const result = await createOrderAction(payload);

    if (!result.success || !result.data) {
      toast.error(result.error ?? "Something went wrong. Please try again.");
      return;
    }

    // Cart is deliberately left intact here — the order is only reserved,
    // not yet paid. It's cleared once the customer actually lands back on
    // the confirmation page with a paid order (see ClearCartOnSuccess).
    if (result.data.checkoutUrl) {
      window.location.href = result.data.checkoutUrl;
      return;
    }

    clearCart();
    router.push(`/confirmation/${result.data.order.id}`);
  }

  /**
   * Moves focus to the first field the customer actually needs to fix, in
   * the order they appear on screen. Without this a submit with no pickup
   * date picked left focus where it was and only painted red text — easy to
   * miss entirely on a phone, where the message can be off-screen.
   */
  function focusFirstError(fieldErrors: typeof errors) {
    const firstInvalid = FIELD_FOCUS_ORDER.find((name) => fieldErrors[name]);
    if (!firstInvalid) return;

    // The pickup fields aren't inputs — one is a popover trigger, the other
    // a group of buttons — so they're reached by id and by ref
    // respectively. Every registered input's id matches its field name.
    const target =
      firstInvalid === "pickupTime"
        ? (pickupTimeGroupRef.current?.querySelector("button") ?? null)
        : document.getElementById(
            firstInvalid === "pickupDate" ? "pickup-date" : firstInvalid,
          );

    target?.focus();
    target?.scrollIntoView({ block: "center", behavior: "smooth" });
  }

  // A named handler, not `onSubmit={handleSubmit(onSubmit)}` inline in JSX:
  // calling handleSubmit(onSubmit) directly in the render body hands a
  // ref-reading closure to a function invoked during render, which trips
  // React Compiler's ref-safety check (it can't prove handleSubmit won't
  // call onSubmit synchronously). Wrapping it here means the ref is only
  // ever touched inside a real event handler — exactly what refs are for.
  // The ref (not the `submitting` state) is what actually prevents a
  // double-submit: two clicks fired before React re-renders both invoke
  // the same closure, which closes over the same stale `submitting` value —
  // only a synchronously-mutated ref, set before the first `await`, is
  // visible to both.
  async function handleFormSubmit(event: FormEvent<HTMLFormElement>) {
    if (submittingRef.current) {
      event.preventDefault();
      return;
    }
    submittingRef.current = true;
    setSubmitting(true);
    try {
      await handleSubmit(onSubmit, focusFirstError)(event);
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  }

  if (items.length === 0) {
    return (
      <div className="mt-10 rounded-xl border border-border bg-card p-8 text-center text-muted-foreground">
        Your cart is empty.{" "}
        <Link href="/" className="text-primary underline underline-offset-4">
          Browse the menu
        </Link>{" "}
        to add something first.
      </div>
    );
  }

  return (
    <form
      onSubmit={handleFormSubmit}
      noValidate
      className="mt-8 grid gap-8 lg:grid-cols-[1fr_320px]"
    >
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="pickup-date">Pickup date</FieldLabel>
          <Popover open={dateOpen} onOpenChange={setDateOpen}>
            <PopoverTrigger asChild>
              <Button
                id="pickup-date"
                type="button"
                variant="outline"
                className="justify-start font-normal"
              >
                <CalendarIcon />
                {selectedDate ? format(selectedDate, "PPP") : "Choose a date"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0">
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={handleDateSelect}
                disabled={isDateDisabled}
                autoFocus
              />
            </PopoverContent>
          </Popover>
          <FieldError errors={[errors.pickupDate]} />
        </Field>

        {selectedDate && (
          <Field>
            <FieldLabel id="pickup-time-label">Pickup time</FieldLabel>
            {/* Labelled group rather than a bare div: this FieldLabel has no
                htmlFor to bind to (the slots are buttons, not one input), so
                without aria-labelledby the label announces as loose text and
                the buttons as an unlabelled pile. */}
            <div
              ref={pickupTimeGroupRef}
              role="group"
              aria-labelledby="pickup-time-label"
              className="flex flex-wrap gap-2"
            >
              {availableSlots.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No pickup times available on this date.
                </p>
              ) : (
                availableSlots.map((slot) => (
                  <Button
                    key={slot}
                    type="button"
                    size="sm"
                    // Selection was conveyed only by `variant` — i.e. purely
                    // visually — on a required field. Mirrors the same
                    // pattern in product-card.tsx's VariantSegments.
                    aria-pressed={pickupTime === slot}
                    variant={pickupTime === slot ? "default" : "outline"}
                    onClick={() => setValue("pickupTime", slot)}
                  >
                    {slot}
                  </Button>
                ))
              )}
            </div>
            <FieldError errors={[errors.pickupTime]} />
          </Field>
        )}

        <Field>
          <FieldLabel htmlFor="customerName">Full name</FieldLabel>
          <Input id="customerName" {...register("customerName")} />
          <FieldError errors={[errors.customerName]} />
        </Field>

        <Field>
          <FieldLabel htmlFor="customerEmail">Email</FieldLabel>
          <Input
            id="customerEmail"
            type="email"
            {...register("customerEmail")}
          />
          <FieldError errors={[errors.customerEmail]} />
        </Field>

        <Field>
          <FieldLabel htmlFor="customerPhone">Phone</FieldLabel>
          <Input id="customerPhone" type="tel" {...register("customerPhone")} />
          <FieldError errors={[errors.customerPhone]} />
        </Field>

        <Field>
          <FieldLabel htmlFor="notes">Notes (optional)</FieldLabel>
          <Textarea
            id="notes"
            rows={3}
            placeholder="Anything we should know about your order?"
            {...register("notes")}
          />
          <FieldError errors={[errors.notes]} />
        </Field>

        <Button type="submit" size="lg" disabled={submitting}>
          {submitting ? "Placing order…" : "Place Order"}
        </Button>

        <p className="text-sm text-muted-foreground">
          You&apos;ll pay securely via Stripe on the next screen. Payment
          reserves your pickup slot — need to change or cancel afterwards?{" "}
          {settings.contactEmail ? (
            <>
              Email us at{" "}
              <a
                href={`mailto:${settings.contactEmail}`}
                className="text-primary underline underline-offset-4"
              >
                {settings.contactEmail}
              </a>{" "}
              and we&apos;ll sort it out.
            </>
          ) : (
            <>Just get in touch and we&apos;ll sort it out.</>
          )}
        </p>
      </FieldGroup>

      <aside className="h-fit rounded-xl border border-border bg-card p-5">
        <h2 className="font-heading text-lg font-semibold text-foreground">
          Order Summary
        </h2>
        <ul className="mt-4 flex flex-col gap-3">
          {items.map((item) => (
            <li
              key={item.variantId}
              className="flex items-center justify-between text-sm"
            >
              <span className="text-foreground">
                {item.quantity} × {item.name}
                {item.variantLabel && (
                  <span className="text-muted-foreground"> — {item.variantLabel}</span>
                )}
              </span>
              <span className="text-muted-foreground">
                {formatPrice(item.price * item.quantity)}
              </span>
            </li>
          ))}
        </ul>
        <div className="mt-4 flex items-center justify-between border-t border-border pt-4 text-base font-medium text-foreground">
          <span>Total</span>
          <span>{formatPrice(subtotal)}</span>
        </div>
      </aside>
    </form>
  );
}
