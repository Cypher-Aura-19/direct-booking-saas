import { signOutAction } from "@/app/login/actions";

export function DashboardHeader({ orgName }: { orgName: string }) {
  return (
    <header className="border-b border-border bg-surface">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
        <span className="font-display text-lg font-medium italic text-foreground">
          {orgName}
        </span>
        <form action={signOutAction}>
          <button
            type="submit"
            className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            Log out
          </button>
        </form>
      </div>
    </header>
  );
}
