import { CreditCard, Lock, Mail } from "lucide-react";

interface CheckoutAssuranceProps {
  contactEmail: string;
}

/**
 * The three things a customer wants to know in the last second before they
 * commit: how they can pay, who handles the card, and that a person will
 * fix it if their plans change.
 *
 * Deliberately words rather than payment-brand logos. Naming the wallets is
 * what does the work on mobile — "Apple Pay" removes the "do I want to type
 * a card number on a phone" hesitation that the card mark alone leaves in
 * place — and it stays true without shipping anyone else's trademark.
 *
 * Deliberately *not* here: "we'll hold your pickup slot for 30 minutes
 * while you pay". The Stripe session does expire, but the customer is about
 * to spend sixty seconds on the next screen, so a thirty-minute window is
 * only ever reached by someone who has wandered off — and for everyone else
 * it introduces a countdown they were not worried about, at the exact
 * moment they are deciding to commit. It described the system's behaviour,
 * not theirs.
 */
export function CheckoutAssurance({ contactEmail }: CheckoutAssuranceProps) {
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
        <Mail className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
        <span>
          Need to change or cancel?{" "}
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
