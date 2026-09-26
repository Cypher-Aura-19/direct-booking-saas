"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { INPUT_CLASSES } from "@/components/ui/input";
import { Notice } from "@/components/ui/notice";
import type { StaySettings } from "@/lib/availability/pricing";
import type { FormState } from "../../actions";

export function SettingsForm({
  action,
  settings,
}: {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  settings: StaySettings;
}) {
  const [state, formAction, pending] = useActionState(action, { error: null, success: false });

  return (
    <form action={formAction} className="flex max-w-2xl flex-col gap-5">
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Minimum stay (nights)">
          <input
            name="minimumStay"
            type="number"
            inputMode="numeric"
            min={1}
            max={60}
            required
            defaultValue={settings.minimumStay}
            className={`${INPUT_CLASSES} font-mono`}
          />
        </Field>
        <Field
          label="Advance to confirm (%)"
          hint="Guests pay this share directly to you to confirm. The rest is due on arrival."
        >
          <input
            name="advancePercent"
            type="number"
            inputMode="numeric"
            min={0}
            max={100}
            required
            defaultValue={settings.advancePercent}
            className={`${INPUT_CLASSES} font-mono`}
          />
        </Field>
      </div>
      {state.error && <Notice tone="error">{state.error}</Notice>}
      {state.success && <Notice tone="success">Saved.</Notice>}
      <div>
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save"}
        </Button>
      </div>
    </form>
  );
}
