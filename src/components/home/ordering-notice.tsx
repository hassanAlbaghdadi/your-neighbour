import { Clock } from "lucide-react";

interface OrderingNoticeProps {
  minAdvanceHours: number;
}

/**
 * Was StoryFacts, a three-up stat strip. Two of its three "stats" were
 * adjectives dressed as values ("Small Batch" / "Local"), and its headline
 * restated the founder note directly above it almost word for word --
 * "never pulled from a shelf" then "Nothing sits on a shelf". A strip is
 * for comparing quantities; there was only ever one quantity here, and
 * surrounding it with filler made the page's single most decision-relevant
 * fact read as decoration.
 *
 * It then spent a while as a full centred section with an eyebrow and a
 * heading at the same scale as "The Menu" -- which made a restriction the
 * first typographic headline anyone read after the hero. A customer met the
 * limitation before they had seen a single thing they might want, and it
 * outranked the products in the page's hierarchy.
 *
 * A strip keeps the fact and drops the weight. The lead time is stated in
 * two further places that are closer to where it actually bites -- the cart
 * footer, and the earliest-pickup line under the checkout date picker -- so
 * this one only has to set expectations in passing, not argue the case.
 */
export function OrderingNotice({ minAdvanceHours }: OrderingNoticeProps) {
  return (
    <section className="border-b border-border bg-background">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-center gap-2 px-4 py-3 sm:px-6">
        <Clock className="size-4 shrink-0 text-terracotta-600" />
        <p className="text-center text-sm text-muted-foreground">
          Orders need {minAdvanceHours} hours’ notice · Pickup only, from the
          North End
        </p>
      </div>
    </section>
  );
}
