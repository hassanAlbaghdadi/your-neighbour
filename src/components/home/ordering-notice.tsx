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
 * So this block does the one job the hero doesn't: set the ordering
 * constraint before anyone starts building a cart they can't check out.
 */
export function OrderingNotice({ minAdvanceHours }: OrderingNoticeProps) {
  return (
    <section className="border-b border-border bg-background">
      <div className="mx-auto w-full max-w-2xl px-4 py-12 text-center sm:px-6 sm:py-14">
        <p className="text-xs font-semibold tracking-wider text-terracotta-600 uppercase">
          Before you order
        </p>
        <p className="mt-4 font-heading text-2xl font-semibold text-foreground sm:text-3xl">
          Orders need {minAdvanceHours} hours’ notice
        </p>
        <p className="mt-3 text-sm text-muted-foreground sm:text-base">
          Pickup only, from the North End. You’ll choose your pickup day
          and time at checkout.
        </p>
      </div>
    </section>
  );
}
