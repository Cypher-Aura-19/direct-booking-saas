"use client";

import { Button } from "@/components/ui/button";

// Next's error boundary for everything under /dashboard except the layout
// itself (the layout's own auth/organisation lookup errors are not caught
// here — see layout.tsx). No stack trace or error message is ever shown to
// the host; details belong in the server log, not the page.
export default function DashboardError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="flex flex-col items-start gap-4 py-12">
      <p className="text-ink">Something went wrong loading this page.</p>
      <Button onClick={reset}>Try again</Button>
    </div>
  );
}
