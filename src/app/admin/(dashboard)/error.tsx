"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

export default function AdminDashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex flex-col items-center gap-4 rounded-xl border border-border bg-card p-8 text-center motion-safe:animate-in motion-safe:fade-in motion-safe:duration-300 motion-safe:ease-out">
      <h1 className="font-heading text-lg font-semibold text-foreground">
        Something went wrong
      </h1>
      <p className="text-sm text-muted-foreground">
        We hit a snag loading this page. The rest of the admin panel is still
        available from the nav above.
      </p>
      <Button onClick={() => reset()}>Try again</Button>
    </div>
  );
}
