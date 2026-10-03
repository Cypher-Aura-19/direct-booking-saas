"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { INPUT_CLASSES } from "@/components/ui/input";
import { Notice } from "@/components/ui/notice";
import type { PaymentInstructions } from "@/lib/bookings/payment-instructions";
import { updatePaymentInstructionsAction } from "./actions";

export function PaymentForm({ instructions }: { instructions: PaymentInstructions }) {
  const [state, formAction, pending] = useActionState(updatePaymentInstructionsAction, { error: null, success: false });
  return (
    <form action={formAction} className="flex max-w-xl flex-col gap-5">
      <p className="text-sm text-muted">Guests see these details only after you approve their request. Nothing is shown while a request is pending.</p>
      <Field label="Bank name"><input name="bankName" maxLength={120} defaultValue={instructions.bankName} className={INPUT_CLASSES} /></Field>
      <Field label="Account title"><input name="accountTitle" maxLength={120} defaultValue={instructions.accountTitle} className={INPUT_CLASSES} /></Field>
      <Field label="Account number / IBAN"><input name="accountNumber" maxLength={120} defaultValue={instructions.accountNumber} className={INPUT_CLASSES} /></Field>
      <Field label="Easypaisa number"><input name="easypaisa" inputMode="tel" defaultValue={instructions.easypaisa} className={INPUT_CLASSES} /></Field>
      <Field label="JazzCash number"><input name="jazzcash" inputMode="tel" defaultValue={instructions.jazzcash} className={INPUT_CLASSES} /></Field>
      <Field label="Note to guests" hint="Optional. Up to 500 characters, e.g. where to send the receipt.">
        <textarea name="note" rows={3} maxLength={500} defaultValue={instructions.note} className={INPUT_CLASSES} />
      </Field>
      {state.error && <Notice tone="error">{state.error}</Notice>}
      {state.success && <Notice tone="success">Saved.</Notice>}
      <Button type="submit" disabled={pending}>{pending ? "Saving…" : "Save payment details"}</Button>
    </form>
  );
}
