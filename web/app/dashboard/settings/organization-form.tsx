"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { INPUT_CLASSES } from "@/components/ui/input";
import type { OrganizationSettings } from "@/lib/organizations/settings";
import { updateOrganizationSettingsAction } from "./actions";

export function OrganizationForm({ organization }: { organization: OrganizationSettings }) {
  const [state, formAction, pending] = useActionState(updateOrganizationSettingsAction, {
    error: null,
    success: false,
  });

  return (
    <form action={formAction} className="flex max-w-md flex-col gap-4">
      <label className="flex flex-col gap-1 text-sm">
        Business name
        <input name="name" required maxLength={80} defaultValue={organization.name} className={INPUT_CLASSES} />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Public slug
        <input name="slug" required minLength={3} maxLength={40} defaultValue={organization.slug} className={INPUT_CLASSES} />
        <span className="text-xs text-muted">
          Your catalogue lives at /s/{organization.slug}. Changing this breaks links you have already shared.
        </span>
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Catalogue headline
        <input
          name="headline"
          maxLength={120}
          defaultValue={organization.headline}
          placeholder="Four cabins above the Attabad lake"
          className={INPUT_CLASSES}
        />
      </label>
      {state.error && <p className="text-sm text-destructive">{state.error}</p>}
      {state.success && <p className="text-sm text-success">Saved.</p>}
      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : "Save"}
      </Button>
    </form>
  );
}
