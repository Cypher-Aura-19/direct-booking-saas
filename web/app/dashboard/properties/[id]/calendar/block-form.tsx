"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { INPUT_CLASSES } from "@/components/ui/input";
import { Notice } from "@/components/ui/notice";
import type { FormState } from "../../actions";

export function BlockForm({
  action,
  today,
}: {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  today: string;
}) {
  const [state, formAction, pending] = useActionState(action, { error: null, success: false });

  return (
    <form action={formAction} className="flex max-w-2xl flex-col gap-5">
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="First night">
          <input name="firstNight" type="date" min={today} required className={`${INPUT_CLASSES} font-mono`} />
        </Field>
        <Field label="Last night">
          <input name="lastNight" type="date" min={today} required className={`${INPUT_CLASSES} font-mono`} />
        </Field>
      </div>
      {state.error && <Notice tone="error">{state.error}</Notice>}
      {state.success && <Notice tone="success">Dates blocked.</Notice>}
      <div>
        <Button type="submit" disabled={pending}>
          {pending ? "Blocking…" : "Block dates"}
        </Button>
      </div>
    </form>
  );
}
