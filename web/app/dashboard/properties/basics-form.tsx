"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { INPUT_CLASSES } from "@/components/ui/input";
import { Notice } from "@/components/ui/notice";
import { PROPERTY_TYPES, type Property } from "@/lib/properties/basics";
import type { FormState } from "./actions";

const SELECT_CLASSES = `${INPUT_CLASSES} appearance-none bg-[url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%235d6474' stroke-width='1.75' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")] bg-[length:1.1rem] bg-[position:right_0.9rem_center] bg-no-repeat pe-10 rtl:bg-[position:left_0.9rem_center]`;

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
    <form action={formAction} className="flex max-w-2xl flex-col gap-5">
      <div className="grid gap-5 sm:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <Field label="Name">
          <input
            name="name"
            required
            maxLength={80}
            defaultValue={property?.name}
            placeholder="River Hut"
            className={INPUT_CLASSES}
          />
        </Field>
        <Field label="Type">
          <select name="propertyType" required defaultValue={property?.property_type ?? ""} className={SELECT_CLASSES}>
            <option value="" disabled>
              Choose…
            </option>
            {PROPERTY_TYPES.map((type) => (
              <option key={type.value} value={type.value}>
                {type.label}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <Field label="Address">
        <input
          name="address"
          required
          maxLength={200}
          defaultValue={property?.address}
          placeholder="Near Baltit Fort, Karimabad, Hunza"
          className={INPUT_CLASSES}
        />
      </Field>
      <div className="grid grid-cols-2 gap-5">
        <Field label="Nightly rate (Rs)">
          <input
            name="baseRate"
            type="number"
            inputMode="numeric"
            min={1}
            step={1}
            required
            defaultValue={property ? property.base_rate_cents / 100 : undefined}
            placeholder="15000"
            className={`${INPUT_CLASSES} font-mono`}
          />
        </Field>
        <Field label="Max guests">
          <input
            name="maxGuests"
            type="number"
            inputMode="numeric"
            min={1}
            max={50}
            required
            defaultValue={property?.max_guests}
            placeholder="4"
            className={`${INPUT_CLASSES} font-mono`}
          />
        </Field>
      </div>
      {state.error && <Notice tone="error">{state.error}</Notice>}
      {state.success && <Notice tone="success">Saved.</Notice>}
      <div className="pt-1">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : submitLabel}
        </Button>
      </div>
    </form>
  );
}
