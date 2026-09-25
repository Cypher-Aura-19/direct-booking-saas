"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { IconLogout } from "@/components/ui/icons";
import { Notice } from "@/components/ui/notice";
import { PageHeader, Sheet, SheetHeader } from "@/components/ui/page-header";
import { PasswordInput } from "@/components/ui/password-input";
import { changePasswordAction, logoutAction } from "./actions";

export default function AccountSettingsPage() {
  const [state, formAction, pending] = useActionState(changePasswordAction, {
    error: null,
    success: false,
  });

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Account" description="Your login. Only you use it; guests never see it." />

      <Sheet>
        <SheetHeader title="Change password" />
        <form action={formAction} className="flex max-w-md flex-col gap-5 p-5 sm:p-6">
          <Field label="New password" hint="At least 6 characters.">
            <PasswordInput name="password" autoComplete="new-password" required minLength={6} />
          </Field>
          {state.error && <Notice tone="error">{state.error}</Notice>}
          {state.success && <Notice tone="success">Password updated.</Notice>}
          <div>
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : "Update password"}
            </Button>
          </div>
        </form>
      </Sheet>

      <Sheet className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
        <div className="flex flex-col gap-1">
          <h2 className="text-base font-semibold text-ink">Log out</h2>
          <p className="text-sm text-muted">Ends your session on this device.</p>
        </div>
        <form action={logoutAction}>
          <Button type="submit" variant="secondary">
            <IconLogout />
            Log out
          </Button>
        </form>
      </Sheet>
    </div>
  );
}
