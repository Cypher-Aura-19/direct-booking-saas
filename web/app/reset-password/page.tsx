"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { resetPasswordAction } from "./actions";

export default function ResetPasswordPage() {
  const [state, formAction, pending] = useActionState(resetPasswordAction, { error: null });

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-6 px-6">
      <h1 className="text-3xl font-medium tracking-tight">Set a new password</h1>
      <form action={formAction} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1 text-sm">
          New password
          <input
            name="password"
            type="password"
            required
            minLength={6}
            className="rounded-card border border-hairline bg-surface px-4 py-2 text-ink"
          />
        </label>
        {state.error && <p className="text-sm text-destructive">{state.error}</p>}
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save password"}
        </Button>
      </form>
    </main>
  );
}
