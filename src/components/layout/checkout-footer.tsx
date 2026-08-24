import { Lock } from "lucide-react";

interface CheckoutFooterProps {
  businessName: string;
  contactEmail: string;
}

/**
 * What replaces the 517px site footer on checkout.
 *
 * The full footer sat *below* the submit button and repeated the menu, the
 * email and Instagram — a nav bar positioned exactly where someone who has
 * just decided to pay is looking. This keeps the two things a hesitating
 * customer actually needs at that moment (who they are paying, and how to
 * reach a human) and nothing that leads away.
 */
export function CheckoutFooter({
  businessName,
  contactEmail,
}: CheckoutFooterProps) {
  return (
    <footer className="mt-auto border-t border-border">
      <div className="mx-auto flex max-w-4xl flex-col gap-2 px-4 py-6 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <p className="flex items-center gap-1.5">
          <Lock className="size-3.5 shrink-0" aria-hidden="true" />
          Payments handled by Stripe. {businessName} never sees your card
          details.
        </p>
        {contactEmail && (
          <p>
            Questions?{" "}
            <a
              href={`mailto:${contactEmail}`}
              className="text-link underline underline-offset-4"
            >
              {contactEmail}
            </a>
          </p>
        )}
      </div>
    </footer>
  );
}
