"use client";

import { Button } from "@/components/ui/button";
import { IconAlert } from "@/components/ui/icons";

// Next's error boundary for everything under /dashboard except the layout
// itself (the layout's own auth/organisation lookup errors are not caught
// here — see layout.tsx). No stack trace or error message is ever shown to
// the host; details belong in the server log, not the page.
export default function DashboardError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="flex flex-col items-start gap-5 rounded-card border border-hairline bg-surface p-6 shadow-[var(--shadow-sheet)] sm:p-8">
      <span className="grid size-12 place-items-center rounded-2xl bg-destructive/[0.08] text-destructive">
        <IconAlert className="size-6" />
      </span>
      <div className="flex flex-col gap-1">
        <p className="text-lg font-medium text-ink">Something went wrong loading this page.</p>
        <p className="text-sm text-muted">Try again. If it keeps happening, reload the page.</p>
      </div>
      <Button onClick={reset}>Try again</Button>
    </div>
  );
}
