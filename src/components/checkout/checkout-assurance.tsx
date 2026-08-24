import { Clock, CreditCard, Lock } from "lucide-react";

interface CheckoutAssuranceProps {
  contactEmail: string;
  /** How long the Stripe session holds the pickup slot, in minutes. */
  holdMinutes: number;
}

/**
 * The three things a customer wants to know in the last second before they
 * commit: who takes the card, what happens to their slot, and how to reach
 * a person if it goes wrong.
 *
 * Deliberately words rather than payment-brand logos. Naming the wallets is
 * what does the work on mobile — "Apple Pay" removes the "do I want to type
 * a card number on a phone" hesitation that the card mark alone leaves in
 * place — and it stays true without shipping anyone else's trademark.
 */
export function CheckoutAssurance({
  contactEmail,
  holdMinutes,
}: CheckoutAssuranceProps) {
  return (
    <div className="flex flex-col gap-2.5 rounded-xl border border-border bg-card p-4 text-sm text-muted-foreground">
      <p className="flex items-start gap-2">
        <CreditCard className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
        <span>
          Pay with <span className="font-medium text-foreground">Apple Pay</span>
          , <span className="font-medium text-foreground">Google Pay</span> or
          any major card on the next screen.
        </span>
      </p>
      <p className="flex items-start gap-2">
        <Lock className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
        <span>
          Handled by Stripe. We never see your card details.
        </span>
      </p>
      <p className="flex items-start gap-2">
        <Clock className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
        <span>
          We&rsquo;ll hold your pickup slot for {holdMinutes} minutes while you
          pay. Need to change or cancel afterwards?{" "}
          {contactEmail ? (
            <>
              Email{" "}
              <a
                href={`mailto:${contactEmail}`}
                className="text-link underline underline-offset-4"
              >
                {contactEmail}
              </a>{" "}
              and we&rsquo;ll sort it out.
            </>
          ) : (
            <>Just get in touch and we&rsquo;ll sort it out.</>
          )}
        </span>
      </p>
    </div>
  );
}
