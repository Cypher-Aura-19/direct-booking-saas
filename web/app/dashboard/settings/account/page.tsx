"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { changePasswordAction, logoutAction } from "./actions";

export default function AccountSettingsPage() {
  const [state, formAction, pending] = useActionState(changePasswordAction, {
    error: null,
    success: false,
  });

  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-2xl font-medium tracking-tight">Account</h1>

      <form action={formAction} className="flex max-w-sm flex-col gap-4">
        <h2 className="text-sm font-medium text-muted">Change password</h2>
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
        {state.success && <p className="text-sm text-success">Password updated.</p>}
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Update password"}
        </Button>
      </form>

      <form action={logoutAction}>
        <Button type="submit" variant="secondary">
          Log out
        </Button>
      </form>
    </div>
  );
}
