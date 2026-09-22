"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { onboardingAction, checkSlugAction } from "./actions";

export default function OnboardingPage() {
  const [state, formAction, pending] = useActionState(onboardingAction, { error: null });
  const [slugStatus, setSlugStatus] = useState<"idle" | "checking" | "available" | "taken">("idle");

  async function handleSlugBlur(event: React.FocusEvent<HTMLInputElement>) {
    const slug = event.target.value.trim();
    if (!slug) {
      setSlugStatus("idle");
      return;
    }
    setSlugStatus("checking");
    const { available } = await checkSlugAction(slug);
    setSlugStatus(available ? "available" : "taken");
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-6 px-6">
      <h1 className="text-3xl font-medium tracking-tight">Set up your business</h1>
      <form action={formAction} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1 text-sm">
          Business name
          <input
            name="name"
            type="text"
            required
            className="rounded-card border border-hairline bg-surface px-4 py-2 text-ink"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Public slug
          <input
            name="slug"
            type="text"
            required
            onBlur={handleSlugBlur}
            className="rounded-card border border-hairline bg-surface px-4 py-2 text-ink"
          />
          {slugStatus === "checking" && <span className="text-xs text-muted">Checking…</span>}
          {slugStatus === "available" && <span className="text-xs text-success">Available</span>}
          {slugStatus === "taken" && <span className="text-xs text-destructive">Already taken</span>}
        </label>
        <label className="flex flex-col gap-1 text-sm">
          City
          <input
            name="city"
            type="text"
            required
            className="rounded-card border border-hairline bg-surface px-4 py-2 text-ink"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Phone
          <input
            name="phone"
            type="tel"
            required
            className="rounded-card border border-hairline bg-surface px-4 py-2 text-ink"
          />
        </label>
        {state.error && <p className="text-sm text-destructive">{state.error}</p>}
        <Button type="submit" disabled={pending}>
          {pending ? "Creating…" : "Continue"}
        </Button>
      </form>
    </main>
  );
}
