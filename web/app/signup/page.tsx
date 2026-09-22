"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { signUpAction } from "./actions";

export default function SignupPage() {
  const [state, formAction, pending] = useActionState(signUpAction, { error: null });

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-6 px-6">
      <h1 className="text-3xl font-medium tracking-tight">Create your account</h1>
      <form action={formAction} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1 text-sm">
          Name
          <input
            name="name"
            type="text"
            required
            className="rounded-card border border-hairline bg-surface px-4 py-2 text-ink"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Email
          <input
            name="email"
            type="email"
            required
            className="rounded-card border border-hairline bg-surface px-4 py-2 text-ink"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Password
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
          {pending ? "Creating account…" : "Sign up"}
        </Button>
      </form>
    </main>
  );
}
