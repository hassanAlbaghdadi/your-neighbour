import { Button } from "@/components/ui/button";
import { signOutAction } from "@/app/actions/auth";
import { AdminNav } from "@/components/admin/admin-nav";

export default function AdminDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-1 flex-col">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-3 sm:h-16 sm:flex-row sm:items-center sm:justify-between sm:gap-0 sm:py-0 sm:px-6">
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
            <span className="font-heading text-lg font-semibold text-foreground">
              Your Neighbour <span className="text-muted-foreground">Admin</span>
            </span>
            <AdminNav />
          </div>
          <form action={signOutAction}>
            <Button type="submit" variant="outline" size="sm">
              Log Out
            </Button>
          </form>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6">
        {children}
      </main>
    </div>
  );
}
