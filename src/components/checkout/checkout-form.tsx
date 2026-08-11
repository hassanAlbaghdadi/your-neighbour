"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { format, isBefore, startOfDay } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
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
import {
  checkoutFormSchema,
  type CheckoutFormValues,
} from "@/lib/validations/order";
import type { StoreSettings } from "@/lib/services/settings/get-settings";

interface CheckoutFormProps {
  settings: StoreSettings;
  orderCounts: Record<string, number>;
}

export function CheckoutForm({ settings, orderCounts }: CheckoutFormProps) {
  const router = useRouter();
  const { items, subtotal, clearCart } = useCart();
  const [selectedDate, setSelectedDate] = useState<Date | undefined>();
  const [submitting, setSubmitting] = useState(false);

  const minAllowed = useMemo(
    () => new Date(Date.now() + settings.minAdvanceHours * 60 * 60 * 1000),
    [settings.minAdvanceHours],
  );

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<CheckoutFormValues>({
    resolver: zodResolver(checkoutFormSchema),
    defaultValues: {
      customerName: "",
      customerEmail: "",
      customerPhone: "",
      pickupDate: "",
      pickupTime: "",
      notes: "",
    },
  });

  const pickupTime = watch("pickupTime");

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
  }

  async function onSubmit(values: CheckoutFormValues) {
    if (items.length === 0) return;
    setSubmitting(true);

    const payload = {
      id: crypto.randomUUID(),
      ...values,
      items: items.map((item) => ({
        variantId: item.variantId,
        quantity: item.quantity,
      })),
    };

    const result = await createOrderAction(payload);
    setSubmitting(false);

    if (!result.success || !result.data) {
      toast.error(result.error ?? "Something went wrong. Please try again.");
      return;
    }

    clearCart();
    router.push(`/confirmation/${result.data.id}`);
  }

  if (items.length === 0) {
    return (
      <div className="mt-10 rounded-xl border border-border bg-card p-8 text-center text-muted-foreground">
        Your cart is empty.{" "}
        <a href="/" className="text-primary underline underline-offset-4">
          Browse the menu
        </a>{" "}
        to add something first.
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      noValidate
      className="mt-8 grid gap-8 lg:grid-cols-[1fr_320px]"
    >
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="pickup-date">Pickup date</FieldLabel>
          <Popover>
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
            <FieldLabel>Pickup time</FieldLabel>
            <div className="flex flex-wrap gap-2">
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
                ${(item.price * item.quantity).toFixed(2)}
              </span>
            </li>
          ))}
        </ul>
        <div className="mt-4 flex items-center justify-between border-t border-border pt-4 text-base font-medium text-foreground">
          <span>Total</span>
          <span>${subtotal.toFixed(2)}</span>
        </div>
      </aside>
    </form>
  );
}
