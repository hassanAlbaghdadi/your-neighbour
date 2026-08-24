"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { format } from "date-fns";
import { AlertCircle, MapPin } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { OrderSummary } from "@/components/checkout/order-summary";
import { PickupDatePicker } from "@/components/checkout/pickup-date-picker";
import { CheckoutAssurance } from "@/components/checkout/checkout-assurance";
import { useCart } from "@/context/cart-context";
import { createOrderAction } from "@/app/actions/orders";
import { cn, formatPrice } from "@/lib/utils";
import { pickupInstant, formatPickupTime } from "@/lib/time";
import { track, trackOnce } from "@/lib/analytics";
import { SESSION_HOLD_MINUTES } from "@/lib/checkout/session-hold";
import {
  createDateStatusResolver,
  findEarliestAvailable,
} from "@/lib/checkout/pickup-availability";
import {
  forgetCustomer,
  readRememberedCustomer,
  rememberCustomer,
} from "@/lib/checkout/remembered-customer";
import {
  checkoutFormSchema,
  type CheckoutFieldName,
  type CheckoutFormValues,
} from "@/lib/validations/order";
import type { StoreSettings } from "@/lib/services/settings/get-settings";

// Screen order, which is what "the first thing to fix" means to a customer
// — not the schema's key order.
const FIELD_FOCUS_ORDER = [
  "pickupDate",
  "pickupTime",
  "customerName",
  "customerEmail",
  "customerPhone",
  "notes",
] as const satisfies readonly CheckoutFieldName[];

function isCheckoutField(name: string | undefined): name is CheckoutFieldName {
  return (
    !!name && (FIELD_FOCUS_ORDER as readonly string[]).includes(name)
  );
}

interface CheckoutFormProps {
  settings: StoreSettings;
  orderCounts: Record<string, number>;
}

export function CheckoutForm({ settings, orderCounts }: CheckoutFormProps) {
  const router = useRouter();
  const { items, itemCount, subtotal, clearCart } = useCart();
  const [selectedDate, setSelectedDate] = useState<Date | undefined>();
  const [dateOpen, setDateOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  // A rejection that belongs to the whole form rather than one control —
  // rate limits, an unavailable item, Stripe being down. Rendered above the
  // submit button and left there, rather than thrown at a toast that
  // auto-dismisses while the customer is still reading it.
  const [formError, setFormError] = useState<string | null>(null);
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
  // it may render through PopoverTrigger's `asChild`, which claims the
  // child's ref for Radix's own use, so one passed to <Button> never reaches
  // the DOM node — it's looked up by the id it already carries for its label.
  const pickupTimeGroupRef = useRef<HTMLDivElement>(null);

  const statusFor = useMemo(
    () => createDateStatusResolver({ settings, orderCounts, minAllowed }),
    [settings, orderCounts, minAllowed],
  );

  const [earliestAvailable] = useState<Date | null>(() =>
    findEarliestAvailable(statusFor),
  );

  const {
    register,
    handleSubmit,
    setValue,
    setError,
    reset,
    control,
    formState: { errors },
  } = useForm<CheckoutFormValues>({
    resolver: zodResolver(checkoutFormSchema),
    // Validate a field once the customer has left it, rather than only after
    // they reach the bottom and commit. A mistyped email is then caught while
    // the keyboard is still up and the fix costs one tap.
    mode: "onTouched",
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
  const [remembered, setRemembered] = useState(false);

  // Contact details from a previous order, restored after mount rather than
  // in defaultValues: localStorage isn't readable during SSR, so seeding the
  // form eagerly would make the server's HTML disagree with the client's
  // first render.
  useEffect(() => {
    const saved = readRememberedCustomer();
    if (!saved) return;
    reset((current) => ({ ...current, ...saved }), {
      keepDefaultValues: true,
    });
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setRemembered(true);
  }, [reset]);

  // Funnel instrumentation. Nothing renders off this — but without it the
  // whole drop-off this page exists to reduce is invisible: `add_to_cart`
  // fired on the menu and then nothing did, all the way to payment.
  useEffect(() => {
    if (items.length === 0) return;
    trackOnce("begin_checkout", { value: subtotal, items: itemCount });
  }, [items.length, subtotal, itemCount]);

  const hasMixBox = items.some((item) =>
    item.variantLabel?.toLowerCase().includes("mix"),
  );

  const availableSlots = useMemo(() => {
    if (!selectedDate) return [];
    const dateStr = format(selectedDate, "yyyy-MM-dd");
    // pickupInstant, not a local Date: a pickup slot is a wall-clock time in
    // the bakery's zone, and the customer's browser may be in another one.
    // See lib/time.ts.
    return settings.pickupTimeSlots.filter(
      (slot) => pickupInstant(dateStr, slot) >= minAllowed,
    );
  }, [selectedDate, settings.pickupTimeSlots, minAllowed]);

  function handleDateSelect(date: Date | undefined) {
    setSelectedDate(date);
    // shouldValidate, or the "Choose a pickup date" error stays on screen
    // underneath a field that now plainly shows a date. react-hook-form's
    // reValidateMode only covers inputs it registered; a programmatic
    // setValue has to ask for validation itself.
    setValue("pickupDate", date ? format(date, "yyyy-MM-dd") : "", {
      shouldValidate: true,
    });
    setValue("pickupTime", "", { shouldValidate: false });
    if (date) track("pickup_date_selected");
    // Closing on select (rather than leaving it open until an outside
    // click) matters here specifically: the pickup-time buttons render
    // directly below the trigger, in the same screen area the still-open
    // popover occupies, so a click aimed at a time slot right after picking
    // a date was landing on the popover instead of the button underneath it.
    setDateOpen(false);
  }

  function handleTimeSelect(slot: string) {
    // Same reason as handleDateSelect above.
    setValue("pickupTime", slot, { shouldValidate: true });
  }

  async function onSubmit(values: CheckoutFormValues) {
    if (items.length === 0) return;
    setFormError(null);

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
      const message = result.error ?? "Something went wrong. Please try again.";
      track("checkout_error", {
        scope: "server",
        field: result.field ?? "form",
      });

      // A rejection that names a control goes to that control and stays
      // there. Everything else — rate limits, an item pulled from the menu,
      // Stripe outages — has no single field to blame and belongs above the
      // submit button, which is where the customer is already looking.
      if (isCheckoutField(result.field)) {
        setError(result.field, { type: "server", message });
        focusFirstError({ [result.field]: true } as typeof errors);
      } else {
        setFormError(message);
      }
      return;
    }

    // Only the three fields that never change between orders, and only once
    // an order has actually been accepted.
    rememberCustomer({
      customerName: values.customerName,
      customerEmail: values.customerEmail,
      customerPhone: values.customerPhone,
    });

    // Cart is deliberately left intact here — the order is only reserved,
    // not yet paid. It's cleared once the customer actually lands back on
    // the confirmation page with a paid order (see ClearCartOnSuccess).
    if (result.data.checkoutUrl) {
      track("payment_redirect", { value: subtotal });
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

    // The pickup fields aren't inputs — one is an overlay trigger, the other
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

  function reportValidationErrors(fieldErrors: typeof errors) {
    const firstInvalid = FIELD_FOCUS_ORDER.find((name) => fieldErrors[name]);
    if (firstInvalid) {
      track("checkout_error", { scope: "client", field: firstInvalid });
    }
    focusFirstError(fieldErrors);
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
      await handleSubmit(onSubmit, reportValidationErrors)(event);
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  }

  function handleForgetMe() {
    forgetCustomer();
    reset(
      {
        customerName: "",
        customerEmail: "",
        customerPhone: "",
      },
      { keepDefaultValues: true, keepErrors: false },
    );
    setRemembered(false);
  }

  if (items.length === 0) {
    return (
      <div className="mt-10 rounded-xl border border-border bg-card p-8 text-center text-muted-foreground">
        Your cart is empty.{" "}
        <Link href="/#menu" className="text-link underline underline-offset-4">
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
      className="mt-6 grid gap-6 lg:grid-cols-[1fr_320px] lg:gap-8"
    >
      {/* Ahead of the fields in the DOM, not just visually. On a phone the
          grid collapses to one column, and this used to land ~200px BELOW
          the submit button -- so the customer entered their details and
          committed without ever seeing what they were buying or what it
          cost. Ordering it here rather than with CSS alone also means a
          screen reader reaches the contents and total before the form,
          which is the same order a sighted phone user now gets. Desktop is
          unchanged: lg:order-2 sends it back to the right-hand column. */}
      <OrderSummary />

      <FieldGroup className="lg:order-1">
        <Field>
          <FieldLabel htmlFor="pickup-date">Pickup date</FieldLabel>
          <PickupDatePicker
            selectedDate={selectedDate}
            open={dateOpen}
            onOpenChange={setDateOpen}
            onSelect={handleDateSelect}
            statusFor={statusFor}
            earliestAvailable={earliestAvailable}
            invalid={!!errors.pickupDate}
            describedBy={errors.pickupDate ? "pickupDate-error" : undefined}
          />
          {/* Answers "why can't I pick today?" at the moment it's asked. The
              48-hour rule is stated on the homepage and in the cart footer,
              but neither is on screen here -- so the first three days simply
              appeared greyed with no reason given. Hidden once a date is
              chosen, when it has nothing left to explain. */}
          {!selectedDate && earliestAvailable && (
            <FieldDescription>
              Earliest pickup is {format(earliestAvailable, "EEE, MMM d")} —
              orders need {settings.minAdvanceHours} hours&rsquo; notice.
            </FieldDescription>
          )}
          <FieldError id="pickupDate-error" errors={[errors.pickupDate]} />
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
              // aria-describedby, not aria-invalid: the latter isn't a
              // supported state on role="group", and pushing it down onto
              // the slot buttons instead painted all seven of them red —
              // which says "every one of these is wrong" when the truth is
              // "you haven't picked one yet". The message below, announced
              // through this describedby and its own role="alert", is the
              // accurate version.
              aria-describedby={
                errors.pickupTime ? "pickupTime-error" : undefined
              }
              // A grid rather than flex-wrap: equal cells scan faster than a
              // ragged row, and the last row stops looking like a different
              // control.
              className="grid grid-cols-3 gap-2 sm:grid-cols-4"
            >
              {availableSlots.length === 0 ? (
                <p className="col-span-full text-sm text-muted-foreground">
                  No pickup times available on this date.
                </p>
              ) : (
                availableSlots.map((slot) => (
                  <Button
                    key={slot}
                    type="button"
                    // Default size, not sm: sm is 40px, under the 44px floor
                    // this codebase commits to, on one of only two controls
                    // a customer must hit before the keyboard appears.
                    // Selection was conveyed only by `variant` — i.e. purely
                    // visually — on a required field. Mirrors the same
                    // pattern in product-card.tsx's VariantSegments.
                    aria-pressed={pickupTime === slot}
                    variant={pickupTime === slot ? "default" : "outline"}
                    className={cn(
                      "w-full px-1 text-[0.8rem]",
                      pickupTime !== slot && "border-input",
                    )}
                    onClick={() => handleTimeSelect(slot)}
                  >
                    {formatPickupTime(slot)}
                  </Button>
                ))
              )}
            </div>
            <FieldError id="pickupTime-error" errors={[errors.pickupTime]} />
          </Field>
        )}

        {/* Where to collect, answered once the "when" is settled rather than
            as a card above the form. Pickup-only means this is something the
            customer needs before they pay -- but it is reference, not a
            decision, so it reads better attached to the time they just
            chose than as 94px of preamble ahead of the first field. */}
        {settings.pickupAddress && (
          <div className="flex items-start gap-2 text-sm text-muted-foreground">
            <MapPin className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            <span>
              Collect from{" "}
              <span className="font-medium text-foreground">
                {settings.pickupAddress}
              </span>
              .{" "}
              <a
                href={`https://maps.google.com/?q=${encodeURIComponent(settings.pickupAddress)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-link underline underline-offset-4"
              >
                Open in maps
              </a>
            </span>
          </div>
        )}

        <Field>
          <FieldLabel htmlFor="customerName">Full name</FieldLabel>
          {/* autoComplete matters more here than anywhere else in the app: this
              is the only form a customer fills, it's mostly filled on a phone,
              and without these three attributes the browser can't offer to
              autofill any of it. It's also WCAG 1.3.5 (Identify Input
              Purpose), which is a AA criterion.

              aria-invalid / aria-describedby / required are set explicitly
              because react-hook-form's register() sets none of them — which
              left input.tsx's own aria-invalid:border-destructive styling as
              dead code, and an invalid field looking exactly like a valid
              one. */}
          <Input
            id="customerName"
            autoComplete="name"
            required
            aria-invalid={!!errors.customerName}
            aria-describedby={
              errors.customerName ? "customerName-error" : undefined
            }
            {...register("customerName")}
          />
          <FieldError id="customerName-error" errors={[errors.customerName]} />
        </Field>

        <Field>
          <FieldLabel htmlFor="customerEmail">Email</FieldLabel>
          <Input
            id="customerEmail"
            type="email"
            autoComplete="email"
            required
            aria-invalid={!!errors.customerEmail}
            aria-describedby={
              errors.customerEmail ? "customerEmail-error" : undefined
            }
            {...register("customerEmail")}
          />
          <FieldDescription>
            Your receipt and pickup reminder go here.
          </FieldDescription>
          <FieldError
            id="customerEmail-error"
            errors={[errors.customerEmail]}
          />
        </Field>

        <Field>
          <FieldLabel htmlFor="customerPhone">Phone</FieldLabel>
          <Input
            id="customerPhone"
            type="tel"
            autoComplete="tel"
            required
            aria-invalid={!!errors.customerPhone}
            aria-describedby={
              errors.customerPhone ? "customerPhone-error" : undefined
            }
            {...register("customerPhone")}
          />
          <FieldError
            id="customerPhone-error"
            errors={[errors.customerPhone]}
          />
        </Field>

        {remembered && (
          <p className="-mt-2 text-sm text-muted-foreground">
            Filled in from your last order.{" "}
            <button
              type="button"
              onClick={handleForgetMe}
              className="text-link underline underline-offset-4"
            >
              Not you?
            </button>
          </p>
        )}

        <Field>
          <FieldLabel htmlFor="notes">Notes (optional)</FieldLabel>
          {/* A mix box is sold as "tell us which flavours you'd like in the
              order notes", and this is that box — but the generic prompt
              gave no hint that a choice was owed, so the request arrived
              blank and someone had to chase it. Matched on the variant
              label rather than the product name because the flavour choice
              belongs to the mix *sizes*, whatever the product is called. */}
          <Textarea
            id="notes"
            rows={3}
            placeholder={
              hasMixBox
                ? "Which flavours would you like in your mix box?"
                : "Anything we should know about your order?"
            }
            aria-invalid={!!errors.notes}
            aria-describedby={errors.notes ? "notes-error" : undefined}
            {...register("notes")}
          />
          <FieldError id="notes-error" errors={[errors.notes]} />
        </Field>

        <CheckoutAssurance
          contactEmail={settings.contactEmail}
          holdMinutes={SESSION_HOLD_MINUTES}
        />

        {formError && (
          <div
            role="alert"
            className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive"
          >
            <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            <span>{formError}</span>
          </div>
        )}

        {/* Sticky rather than a second, duplicated bar: one submit button,
            pinned to the bottom of the viewport while the form is in view.
            The page ran 1,827px on a phone, so the total and the way
            forward were both routinely off screen -- and the label already
            carries the amount, so pinning it keeps "what will this cost me?"
            answered without repeating the figure somewhere else.

            "Place Order" was a promise this button doesn't keep -- it
            creates the order, then hands off to Stripe, so the customer met
            an unexpected payment screen at the exact moment they thought
            they were done. */}
        <div className="sticky bottom-0 -mx-4 mt-2 border-t border-border bg-background/95 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur supports-backdrop-filter:bg-background/80 sm:-mx-6 sm:px-6 lg:static lg:mx-0 lg:border-0 lg:bg-transparent lg:p-0 lg:backdrop-blur-none">
          {selectedDate && pickupTime && (
            <p className="mb-2 text-center text-xs text-muted-foreground lg:hidden">
              Pickup {format(selectedDate, "EEE, MMM d")} at{" "}
              {formatPickupTime(pickupTime)}
            </p>
          )}
          <Button
            type="submit"
            size="lg"
            disabled={submitting}
            className="w-full text-base"
          >
            {submitting
              ? "Taking you to payment…"
              : `Continue to payment · ${formatPrice(subtotal)}`}
          </Button>
        </div>
      </FieldGroup>
    </form>
  );
}
