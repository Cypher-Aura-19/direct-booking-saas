"use client";

import { useActionState } from "react";
import { AuthShell, SCENES } from "@/components/auth/auth-shell";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { INPUT_CLASSES } from "@/components/ui/input";
import { Notice } from "@/components/ui/notice";
import { PasswordInput } from "@/components/ui/password-input";
import { IconArrowRight } from "@/components/ui/icons";
import { signUpAction } from "./actions";

export default function SignupPage() {
  const [state, formAction, pending] = useActionState(signUpAction, { error: null });

  return (
    <AuthShell
      title="Open your register"
      lede="Set up a booking page for your guesthouse, then share one link on Instagram and WhatsApp."
      scene={SCENES.blossom}
      aside={{ stamp: "For hosts", line: "Bookings, guest chat and Hotel Eye records, all in one place." }}
      footer={
        <>
          Already have an account?{" "}
          <a href="/login" className="font-medium text-accent underline-offset-4 hover:underline">
            Log in
          </a>
        </>
      }
    >
      <form action={formAction} className="flex flex-col gap-5">
        <Field label="Your name">
          <input name="name" type="text" autoComplete="name" required className={INPUT_CLASSES} />
        </Field>
        <Field label="Email">
          <input name="email" type="email" autoComplete="email" required className={INPUT_CLASSES} />
        </Field>
        <Field label="Password" hint="At least 6 characters.">
          <PasswordInput name="password" autoComplete="new-password" required minLength={6} />
        </Field>
        {state.error && <Notice tone="error">{state.error}</Notice>}
        <Button type="submit" disabled={pending} className="mt-1 w-full">
          {pending ? "Creating account…" : "Sign up"}
          {!pending && <IconArrowRight />}
        </Button>
      </form>
    </AuthShell>
  );
}
