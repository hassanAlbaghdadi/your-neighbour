"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { updateOrderStatusAction } from "@/app/actions/orders";
import { ORDER_STATUSES, type OrderStatus } from "@/types/database";

export function OrderStatusSelect({
  orderId,
  status,
}: {
  orderId: string;
  status: OrderStatus;
}) {
  const [value, setValue] = useState<OrderStatus>(status);
  const [isPending, startTransition] = useTransition();

  function handleChange(next: string) {
    const previous = value;
    const nextStatus = next as OrderStatus;
    setValue(nextStatus);

    startTransition(async () => {
      const result = await updateOrderStatusAction(orderId, nextStatus);
      if (!result.success) {
        setValue(previous);
        toast.error(result.error ?? "Failed to update status");
      }
    });
  }

  return (
    <Select value={value} onValueChange={handleChange} disabled={isPending}>
      <SelectTrigger className="w-36" size="sm">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {ORDER_STATUSES.map((s) => (
          <SelectItem key={s} value={s}>
            {s}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
