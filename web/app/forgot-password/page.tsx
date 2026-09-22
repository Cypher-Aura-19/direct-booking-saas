"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { forgotPasswordAction } from "./actions";

export default function ForgotPasswordPage() {
  const [state, formAction, pending] = useActionState(forgotPasswordAction, {
    error: null,
    sent: false,
  });

  if (state.sent) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-4 px-6 text-center">
        <h1 className="text-2xl font-medium tracking-tight">Check your email</h1>
        <p className="text-muted">If that address has an account, a reset link is on its way.</p>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-6 px-6">
      <h1 className="text-3xl font-medium tracking-tight">Reset your password</h1>
      <form action={formAction} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1 text-sm">
          Email
          <input
            name="email"
            type="email"
            required
            className="rounded-card border border-hairline bg-surface px-4 py-2 text-ink"
          />
        </label>
        {state.error && <p className="text-sm text-destructive">{state.error}</p>}
        <Button type="submit" disabled={pending}>
          {pending ? "Sending…" : "Send reset link"}
        </Button>
      </form>
    </main>
  );
}
