interface StoryFactsProps {
  minAdvanceHours: number;
}

export function StoryFacts({ minAdvanceHours }: StoryFactsProps) {
  const facts = [
    { value: `${minAdvanceHours} hrs`, label: "Advance notice" },
    { value: "Small Batch", label: "Baked to order" },
    { value: "Local", label: "Pickup only" },
  ];

  return (
    <section className="border-b border-border bg-background">
      <div className="mx-auto w-full max-w-6xl px-4 py-14 sm:px-6">
        <p className="mx-auto max-w-2xl text-center font-heading text-xl font-medium text-foreground sm:text-2xl">
          Nothing sits on a shelf. Every order is mixed, proofed, and baked
          after it&apos;s placed — then handed to you at pickup.
        </p>

        <dl className="mx-auto mt-10 grid max-w-2xl grid-cols-3 divide-x divide-border border-y border-border">
          {facts.map((fact) => (
            <div
              key={fact.label}
              className="flex flex-col items-center gap-1 px-1 py-3 text-center"
            >
              <dt className="sr-only">{fact.label}</dt>
              <dd className="font-heading text-base font-semibold text-terracotta-600 sm:text-lg">
                {fact.value}
              </dd>
              <span className="text-[10px] font-medium tracking-wide text-muted-foreground uppercase sm:text-xs">
                {fact.label}
              </span>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
