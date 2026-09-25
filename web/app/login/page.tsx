"use client";

import { useActionState } from "react";
import { AuthShell, SCENES } from "@/components/auth/auth-shell";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { INPUT_CLASSES } from "@/components/ui/input";
import { Notice } from "@/components/ui/notice";
import { PasswordInput } from "@/components/ui/password-input";
import { IconArrowRight } from "@/components/ui/icons";
import { PRODUCT_NAME } from "@/lib/brand";
import { loginAction } from "./actions";

export default function LoginPage() {
  const [state, formAction, pending] = useActionState(loginAction, { error: null });

  return (
    <AuthShell
      title="Welcome back"
      lede="Log in to see what needs you today: booking requests, guest chats and arrivals."
      scene={SCENES.guesthouse}
      aside={{ stamp: "Direct booking", line: "Your guests book with you. Nobody takes a cut in between." }}
      footer={
        <>
          New to {PRODUCT_NAME}?{" "}
          <a href="/signup" className="font-medium text-accent underline-offset-4 hover:underline">
            Create an account
          </a>
        </>
      }
    >
      <form action={formAction} className="flex flex-col gap-5">
        <Field label="Email">
          <input name="email" type="email" autoComplete="email" required className={INPUT_CLASSES} />
        </Field>
        <Field label="Password">
          <PasswordInput name="password" autoComplete="current-password" required />
        </Field>
        <a
          href="/forgot-password"
          className="-mt-2 inline-flex min-h-11 w-fit items-center text-sm text-accent underline-offset-4 hover:underline"
        >
          Forgot your password?
        </a>
        {state.error && <Notice tone="error">{state.error}</Notice>}
        <Button type="submit" disabled={pending} className="w-full">
          {pending ? "Logging in…" : "Log in"}
          {!pending && <IconArrowRight />}
        </Button>
      </form>
    </AuthShell>
  );
}
