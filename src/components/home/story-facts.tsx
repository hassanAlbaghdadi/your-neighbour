interface StoryFactsProps {
  minAdvanceHours: number;
}

export function StoryFacts({ minAdvanceHours }: StoryFactsProps) {
  const facts = [
    { value: `${minAdvanceHours} hrs`, label: "Advance notice" },
    { value: "Small batch", label: "Baked to order" },
    { value: "Local", label: "Pickup only" },
  ];

  return (
    <section className="border-b border-border bg-background">
      <div className="mx-auto w-full max-w-6xl px-4 py-14 sm:px-6">
        <p className="mx-auto max-w-2xl text-center font-heading text-xl font-medium text-foreground sm:text-2xl">
          Nothing sits on a shelf. Every order is mixed, proofed, and baked
          after it&apos;s placed — then handed to you at pickup, still warm
          from the oven.
        </p>

        <dl className="mx-auto mt-10 grid max-w-2xl grid-cols-1 divide-y divide-border border-y border-border sm:grid-cols-3 sm:divide-x sm:divide-y-0">
          {facts.map((fact) => (
            <div
              key={fact.label}
              className="flex flex-col items-center gap-1 py-4 text-center sm:py-2"
            >
              <dt className="sr-only">{fact.label}</dt>
              <dd className="font-heading text-lg font-semibold text-terracotta-600">
                {fact.value}
              </dd>
              <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                {fact.label}
              </span>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
