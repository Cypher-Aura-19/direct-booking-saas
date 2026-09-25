"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { INPUT_CLASSES } from "@/components/ui/input";
import { Notice } from "@/components/ui/notice";
import type { OrganizationSettings } from "@/lib/organizations/settings";
import { updateOrganizationSettingsAction } from "./actions";

export function OrganizationForm({ organization }: { organization: OrganizationSettings }) {
  const [state, formAction, pending] = useActionState(updateOrganizationSettingsAction, {
    error: null,
    success: false,
  });

  return (
    <form action={formAction} className="flex max-w-xl flex-col gap-5">
      <Field label="Business name">
        <input name="name" required maxLength={80} defaultValue={organization.name} className={INPUT_CLASSES} />
      </Field>
      <Field
        label="Public slug"
        hint={
          <>
            Your catalogue lives at <span className="font-mono text-ink">/s/{organization.slug}</span>. Changing this
            breaks links you have already shared.
          </>
        }
      >
        <input
          name="slug"
          required
          minLength={3}
          maxLength={40}
          autoCapitalize="none"
          spellCheck={false}
          defaultValue={organization.slug}
          className={`${INPUT_CLASSES} font-mono`}
        />
      </Field>
      <Field label="Catalogue headline" hint="One line under your name. Up to 120 characters.">
        <input
          name="headline"
          maxLength={120}
          defaultValue={organization.headline}
          placeholder="Four cabins above the Attabad lake"
          className={INPUT_CLASSES}
        />
      </Field>
      {state.error && <Notice tone="error">{state.error}</Notice>}
      {state.success && <Notice tone="success">Saved.</Notice>}
      <div className="pt-1">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save"}
        </Button>
      </div>
    </form>
  );
}
