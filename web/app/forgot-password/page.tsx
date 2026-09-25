"use client";

import { useActionState } from "react";
import { AuthMessage, AuthShell, SCENES } from "@/components/auth/auth-shell";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { INPUT_CLASSES } from "@/components/ui/input";
import { Notice } from "@/components/ui/notice";
import { IconMail } from "@/components/ui/icons";
import { forgotPasswordAction } from "./actions";

const BACK_TO_LOGIN = (
  <>
    Remembered it?{" "}
    <a href="/login" className="font-medium text-accent underline-offset-4 hover:underline">
      Back to log in
    </a>
  </>
);

export default function ForgotPasswordPage() {
  const [state, formAction, pending] = useActionState(forgotPasswordAction, {
    error: null,
    sent: false,
  });

  if (state.sent) {
    return (
      <AuthShell title="Check your email" scene={SCENES.valley} footer={BACK_TO_LOGIN}>
        <AuthMessage icon={<IconMail className="size-6" />} title="Reset link on its way">
          If that address has an account, a reset link is on its way.
        </AuthMessage>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Reset your password"
      lede="Enter the email you signed up with and we'll send you a link to set a new password."
      scene={SCENES.valley}
      footer={BACK_TO_LOGIN}
    >
      <form action={formAction} className="flex flex-col gap-5">
        <Field label="Email">
          <input name="email" type="email" autoComplete="email" required className={INPUT_CLASSES} />
        </Field>
        {state.error && <Notice tone="error">{state.error}</Notice>}
        <Button type="submit" disabled={pending} className="w-full">
          {pending ? "Sending…" : "Send reset link"}
        </Button>
      </form>
    </AuthShell>
  );
}
