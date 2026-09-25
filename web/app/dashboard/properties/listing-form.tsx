"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { INPUT_CLASSES } from "@/components/ui/input";
import { Notice } from "@/components/ui/notice";
import { AMENITIES, type Listing } from "@/lib/properties/listing";
import type { FormState } from "./actions";

export function ListingForm({
  action,
  listing,
}: {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  listing: Listing;
}) {
  const [state, formAction, pending] = useActionState(action, { error: null, success: false });
  return (
    <form action={formAction} className="flex max-w-2xl flex-col gap-6">
      <Field label="Description" hint="What makes the stay special. Guests read this on your public page. Up to 2,000 characters.">
        <textarea name="description" rows={5} maxLength={2000} defaultValue={listing.description} className={`${INPUT_CLASSES} resize-y leading-6`} />
      </Field>
      <fieldset className="flex flex-col gap-3">
        <legend className="text-sm font-medium text-ink">Amenities</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {AMENITIES.map((amenity) => (
            <label
              key={amenity.value}
              className="flex min-h-11 cursor-pointer items-center gap-3 rounded-[var(--radius-field)] border border-hairline bg-surface px-3 text-sm text-ink has-[:checked]:border-accent has-[:checked]:bg-accent-soft"
            >
              <input type="checkbox" name="amenities" value={amenity.value} defaultChecked={listing.amenities.includes(amenity.value)} className="size-4 accent-[var(--accent)]" />
              {amenity.label}
            </label>
          ))}
        </div>
      </fieldset>
      {state.error && <Notice tone="error">{state.error}</Notice>}
      {state.success && <Notice tone="success">Saved.</Notice>}
      <div>
        <Button type="submit" disabled={pending}>{pending ? "Saving…" : "Save details"}</Button>
      </div>
    </form>
  );
}
