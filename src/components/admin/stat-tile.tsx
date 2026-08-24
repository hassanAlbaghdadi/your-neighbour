import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function StatTile({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: "primary" | "secondary";
}) {
  return (
    <Card size="sm">
      <CardContent className="flex flex-col gap-1">
        <span className="text-sm text-muted-foreground">{label}</span>
        <span
          className={cn(
            "font-heading text-2xl font-semibold text-foreground",
            accent === "primary" && "text-primary",
            accent === "secondary" && "text-secondary",
          )}
        >
          {value}
        </span>
      </CardContent>
    </Card>
  );
}
