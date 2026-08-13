import type Stripe from "stripe";
import { getStripeClient } from "@/lib/stripe/client";
import { markOrderPaid } from "@/lib/services/orders/mark-order-paid";
import { cancelExpiredOrder } from "@/lib/services/orders/cancel-expired-order";

function orderIdFromSession(session: Stripe.Checkout.Session): string | null {
  return session.metadata?.order_id ?? session.client_reference_id ?? null;
}

export async function POST(request: Request) {
  const signature = request.headers.get("stripe-signature");
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!signature || !webhookSecret) {
    return new Response("Missing signature", { status: 400 });
  }

  const rawBody = await request.text();

  let event: Stripe.Event;
  try {
    event = getStripeClient().webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (error) {
    console.error("Stripe webhook signature verification failed:", error);
    return new Response("Invalid signature", { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        // For delayed payment methods (bank debits etc.), a completed
        // checkout doesn't mean the money has arrived yet — payment_status
        // stays "unpaid" until async_payment_succeeded follows. Only
        // synchronous methods (card, Apple/Google Pay) are "paid" here.
        const session = event.data.object;
        const orderId = orderIdFromSession(session);
        if (orderId && session.payment_status === "paid") {
          await markOrderPaid(orderId);
        }
        break;
      }
      case "checkout.session.async_payment_succeeded": {
        const orderId = orderIdFromSession(event.data.object);
        if (orderId) await markOrderPaid(orderId);
        break;
      }
      case "checkout.session.async_payment_failed":
      case "checkout.session.expired": {
        const orderId = orderIdFromSession(event.data.object);
        if (orderId) await cancelExpiredOrder(orderId);
        break;
      }
      default:
        break;
    }
  } catch (error) {
    console.error(`Stripe webhook handler failed for ${event.type}:`, error);
    // A 500 tells Stripe to retry the event later instead of quietly
    // marking it delivered.
    return new Response("Webhook handler error", { status: 500 });
  }

  return Response.json({ received: true });
}
