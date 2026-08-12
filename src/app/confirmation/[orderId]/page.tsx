import Link from "next/link";
import { notFound } from "next/navigation";
import { format, parseISO } from "date-fns";
import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getOrderById } from "@/lib/services/orders/get-order";
import { formatPrice } from "@/lib/utils";

export default async function ConfirmationPage(
  props: PageProps<"/confirmation/[orderId]">,
) {
  const { orderId } = await props.params;
  const order = await getOrderById(orderId);

  if (!order) {
    notFound();
  }

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-12 sm:px-6">
      <div className="flex flex-col items-center text-center">
        <CheckCircle2 className="size-12 text-primary" />
        <h1 className="mt-4 font-heading text-3xl font-semibold text-foreground">
          Order Confirmed
        </h1>
        <p className="mt-2 text-muted-foreground">
          Thanks, {order.customerName.split(" ")[0]} — we&apos;ll have it
          ready for pickup.
        </p>
      </div>

      <div className="mt-8 rounded-xl border border-border bg-card p-6">
        <div className="grid grid-cols-2 gap-4 border-b border-border pb-4 text-sm">
          <div>
            <p className="text-muted-foreground">Pickup date</p>
            <p className="font-medium text-foreground">
              {format(parseISO(order.pickupDate), "EEEE, MMMM d, yyyy")}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground">Pickup time</p>
            <p className="font-medium text-foreground">{order.pickupTime}</p>
          </div>
        </div>

        <ul className="flex flex-col gap-3 py-4">
          {order.items.map((item, index) => (
            <li
              key={index}
              className="flex items-center justify-between text-sm"
            >
              <span className="text-foreground">
                {item.quantity} × {item.productName}
                {item.variantLabel && (
                  <span className="text-muted-foreground"> — {item.variantLabel}</span>
                )}
              </span>
              <span className="text-muted-foreground">
                {formatPrice(item.unitPrice * item.quantity)}
              </span>
            </li>
          ))}
        </ul>

        <div className="flex items-center justify-between border-t border-border pt-4 text-base font-medium text-foreground">
          <span>Total</span>
          <span>{formatPrice(order.total)}</span>
        </div>

        {order.notes && (
          <p className="mt-4 rounded-lg bg-muted p-3 text-sm text-muted-foreground">
            <span className="font-medium text-foreground">Notes: </span>
            {order.notes}
          </p>
        )}
      </div>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        Order #{order.id.slice(0, 8)} · Status: {order.status}
      </p>

      <div className="mt-8 flex justify-center">
        <Button asChild variant="outline">
          <Link href="/">Back to Menu</Link>
        </Button>
      </div>
    </div>
  );
}
