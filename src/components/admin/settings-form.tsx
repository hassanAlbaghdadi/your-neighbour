"use client";

import { useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { updateSettingsAction } from "@/app/actions/settings";
import {
  settingsSchema,
  type SettingsFormInput,
} from "@/lib/validations/settings";
import type { StoreSettings } from "@/lib/services/settings/get-settings";

export function SettingsForm({ settings }: { settings: StoreSettings }) {
  const [submitting, setSubmitting] = useState(false);
  const [newSlot, setNewSlot] = useState("");
  const [newBlackoutDate, setNewBlackoutDate] = useState("");

  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<SettingsFormInput>({
    resolver: zodResolver(settingsSchema),
    defaultValues: settings,
  });

  async function onSubmit(values: SettingsFormInput) {
    setSubmitting(true);
    const result = await updateSettingsAction(values);
    setSubmitting(false);

    if (!result.success) {
      toast.error(result.error ?? "Failed to save settings.");
      return;
    }
    toast.success("Settings saved.");
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="max-w-xl">
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="businessName">Business name</FieldLabel>
          <Input id="businessName" {...register("businessName")} />
          <FieldError errors={[errors.businessName]} />
        </Field>

        <Field>
          <FieldLabel htmlFor="contactEmail">
            Contact email (order alerts)
          </FieldLabel>
          <Input id="contactEmail" type="email" {...register("contactEmail")} />
          <FieldError errors={[errors.contactEmail]} />
        </Field>

        <Field>
          <FieldLabel htmlFor="pickupAddress">Pickup address</FieldLabel>
          <Input
            id="pickupAddress"
            placeholder="12 Example St, Halifax NS B3K 1A1"
            {...register("pickupAddress")}
          />
          {/* Shown to the customer at checkout, on the confirmation page and
              in their receipt, with a map link built from it. Left empty,
              those blocks are hidden rather than rendered blank. */}
          <FieldError errors={[errors.pickupAddress]} />
        </Field>

        <Field>
          <FieldLabel htmlFor="maxOrdersPerDay">Max orders per day</FieldLabel>
          <Input
            id="maxOrdersPerDay"
            type="number"
            min={1}
            {...register("maxOrdersPerDay")}
          />
          <FieldError errors={[errors.maxOrdersPerDay]} />
        </Field>

        <Field>
          <FieldLabel htmlFor="minAdvanceHours">
            Minimum advance notice (hours)
          </FieldLabel>
          <Input
            id="minAdvanceHours"
            type="number"
            min={0}
            {...register("minAdvanceHours")}
          />
          <FieldError errors={[errors.minAdvanceHours]} />
        </Field>

        <Controller
          control={control}
          name="pickupTimeSlots"
          render={({ field }) => (
            <Field>
              <FieldLabel>Pickup time slots</FieldLabel>
              <div className="flex flex-wrap gap-2">
                {field.value.map((slot) => (
                  <Badge key={slot} variant="outline" className="gap-1 py-1">
                    {slot}
                    <button
                      type="button"
                      onClick={() =>
                        field.onChange(field.value.filter((s) => s !== slot))
                      }
                      aria-label={`Remove ${slot}`}
                    >
                      <X className="size-3" />
                    </button>
                  </Badge>
                ))}
              </div>
              <div className="flex gap-2">
                <Input
                  type="time"
                  value={newSlot}
                  onChange={(e) => setNewSlot(e.target.value)}
                  className="w-36"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    if (newSlot && !field.value.includes(newSlot)) {
                      field.onChange([...field.value, newSlot].sort());
                      setNewSlot("");
                    }
                  }}
                >
                  Add
                </Button>
              </div>
              <FieldError errors={[errors.pickupTimeSlots]} />
            </Field>
          )}
        />

        <Controller
          control={control}
          name="blackoutDates"
          render={({ field }) => (
            <Field>
              <FieldLabel>Blackout dates (closed for orders)</FieldLabel>
              <div className="flex flex-wrap gap-2">
                {field.value.map((date) => (
                  <Badge key={date} variant="outline" className="gap-1 py-1">
                    {date}
                    <button
                      type="button"
                      onClick={() =>
                        field.onChange(field.value.filter((d) => d !== date))
                      }
                      aria-label={`Remove ${date}`}
                    >
                      <X className="size-3" />
                    </button>
                  </Badge>
                ))}
              </div>
              <div className="flex gap-2">
                <Input
                  type="date"
                  value={newBlackoutDate}
                  onChange={(e) => setNewBlackoutDate(e.target.value)}
                  className="w-40"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    if (newBlackoutDate && !field.value.includes(newBlackoutDate)) {
                      field.onChange([...field.value, newBlackoutDate].sort());
                      setNewBlackoutDate("");
                    }
                  }}
                >
                  Add
                </Button>
              </div>
              <FieldError errors={[errors.blackoutDates]} />
            </Field>
          )}
        />

        <Button type="submit" disabled={submitting} className="w-fit">
          {submitting ? "Saving…" : "Save Settings"}
        </Button>
      </FieldGroup>
    </form>
  );
}
