"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Clock, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

const POLL_INTERVAL_MS = 2000;
const MAX_POLLS = 15;

/**
 * Shown on the confirmation page while an order is still unpaid.
 *
 * Stripe redirects the customer to success_url the moment payment is
 * authorized, which routinely beats the webhook that flips payment_status
 * — so a customer who paid successfully lands here, on a page that used to
 * just tell them to refresh it themselves. Polling closes that gap without
 * needing the redirect and the webhook to be ordered.
 *
 * router.refresh() re-runs the server component (re-reading the order)
 * while preserving this component's own state, so the attempt counter
 * survives each pass. Once the order reads paid the parent stops rendering
 * this entirely, which is what ends the loop.
 */
export function PendingPayment() {
  const router = useRouter();
  const [attempts, setAttempts] = useState(0);

  const exhausted = attempts >= MAX_POLLS;

  useEffect(() => {
    if (exhausted) return;

    const timer = setTimeout(() => {
      setAttempts((current) => current + 1);
      router.refresh();
    }, POLL_INTERVAL_MS);

    return () => clearTimeout(timer);
    // Re-runs on each attempt, scheduling the next pass — a self-rescheduling
    // timeout rather than setInterval, so a slow refresh can't stack up
    // overlapping requests behind a fixed tick.
  }, [attempts, exhausted, router]);

  return (
    <div
      className="flex flex-col items-center text-center"
      // Announced to screen readers when it flips to the slow-path message,
      // which is otherwise a purely visual change to a page the customer is
      // anxiously watching.
      role="status"
      aria-live="polite"
    >
      <Clock
        className={
          exhausted
            ? "size-12 text-muted-foreground"
            : "size-12 text-muted-foreground motion-safe:animate-pulse"
        }
      />
      <h1 className="mt-4 font-heading text-3xl font-semibold text-foreground">
        {exhausted ? "Still confirming your payment" : "Confirming payment…"}
      </h1>
      {exhausted ? (
        <>
          <p className="mt-2 max-w-md text-muted-foreground">
            Your payment may still be going through. If you were charged,
            your order is safe — we&apos;ll email your receipt as soon as it
            clears. Get in touch if you don&apos;t hear from us shortly.
          </p>
          <Button
            variant="outline"
            className="mt-4"
            onClick={() => {
              setAttempts(0);
              router.refresh();
            }}
          >
            <RefreshCw /> Check again
          </Button>
        </>
      ) : (
        <p className="mt-2 text-muted-foreground">
          This usually only takes a few seconds — this page updates on its
          own.
        </p>
      )}
    </div>
  );
}
