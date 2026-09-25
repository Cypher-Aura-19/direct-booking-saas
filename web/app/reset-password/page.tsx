"use client";

import { useActionState } from "react";
import { AuthShell, SCENES } from "@/components/auth/auth-shell";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Notice } from "@/components/ui/notice";
import { PasswordInput } from "@/components/ui/password-input";
import { resetPasswordAction } from "./actions";

export default function ResetPasswordPage() {
  const [state, formAction, pending] = useActionState(resetPasswordAction, { error: null });

  return (
    <AuthShell title="Set a new password" lede="Choose something you haven't used here before." scene={SCENES.valley}>
      <form action={formAction} className="flex flex-col gap-5">
        <Field label="New password" hint="At least 6 characters.">
          <PasswordInput name="password" autoComplete="new-password" required minLength={6} />
        </Field>
        {state.error && <Notice tone="error">{state.error}</Notice>}
        <Button type="submit" disabled={pending} className="w-full">
          {pending ? "Saving…" : "Save password"}
        </Button>
      </form>
    </AuthShell>
  );
}
