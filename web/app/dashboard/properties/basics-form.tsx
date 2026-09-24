"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { INPUT_CLASSES } from "@/components/ui/input";
import { PROPERTY_TYPES, type Property } from "@/lib/properties/basics";
import type { FormState } from "./actions";

export function BasicsForm({
  action,
  property,
  submitLabel,
}: {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  property?: Property;
  submitLabel: string;
}) {
  const [state, formAction, pending] = useActionState(action, { error: null, success: false });

  return (
    <form action={formAction} className="flex max-w-md flex-col gap-4">
      <label className="flex flex-col gap-1 text-sm">
        Name
        <input name="name" required maxLength={80} defaultValue={property?.name} className={INPUT_CLASSES} />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Type
        <select name="propertyType" required defaultValue={property?.property_type ?? ""} className={INPUT_CLASSES}>
          <option value="" disabled>
            Choose…
          </option>
          {PROPERTY_TYPES.map((type) => (
            <option key={type.value} value={type.value}>
              {type.label}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Address
        <input name="address" required maxLength={200} defaultValue={property?.address} className={INPUT_CLASSES} />
      </label>
      <div className="grid grid-cols-2 gap-4">
        <label className="flex flex-col gap-1 text-sm">
          Nightly rate (Rs)
          <input
            name="baseRate"
            type="number"
            inputMode="numeric"
            min={1}
            step={1}
            required
            defaultValue={property ? property.base_rate_cents / 100 : undefined}
            className={INPUT_CLASSES}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Max guests
          <input
            name="maxGuests"
            type="number"
            inputMode="numeric"
            min={1}
            max={50}
            required
            defaultValue={property?.max_guests}
            className={INPUT_CLASSES}
          />
        </label>
      </div>
      {state.error && <p className="text-sm text-destructive">{state.error}</p>}
      {state.success && <p className="text-sm text-success">Saved.</p>}
      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : submitLabel}
      </Button>
    </form>
  );
}
