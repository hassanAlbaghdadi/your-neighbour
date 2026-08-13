import Link from "next/link";
import { Button } from "@/components/ui/button";

export function StoryCta() {
  return (
    <section className="bg-cream-50">
      <div className="mx-auto w-full max-w-6xl px-4 py-14 sm:px-6 sm:py-20">
        <div className="rounded-2xl bg-espresso-900 px-6 py-12 text-center sm:px-12 sm:py-16">
          <p className="font-heading text-2xl font-semibold text-cream-50 sm:text-3xl">
            That&apos;s the whole story. Now, what can we bake for you?
          </p>
          <p className="mx-auto mt-3 max-w-md text-sm text-cream-50/80 sm:text-base">
            Orders need a little lead time — place yours ahead and it&apos;ll
            be fresh out of the oven when you pick it up.
          </p>
          <Button asChild size="lg" className="mt-7">
            <Link href="/#menu">See the menu</Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
