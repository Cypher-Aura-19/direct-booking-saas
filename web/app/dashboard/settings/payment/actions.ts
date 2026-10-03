"use server";

import { revalidatePath } from "next/cache";
import { parsePaymentInstructions, updatePaymentInstructions } from "@/lib/bookings/payment-instructions";
import { dashboardContext } from "../../_lib/context";
import type { FormState } from "../../properties/actions";

export async function updatePaymentInstructionsAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const { supabase, organization } = await dashboardContext();
  const fields = Object.fromEntries(
    ["bankName", "accountTitle", "accountNumber", "easypaisa", "jazzcash", "note"].map((k) => [k, String(formData.get(k) ?? "")]),
  );
  const parsed = parsePaymentInstructions(fields);
  if ("error" in parsed) return { error: parsed.error, success: false };
  const { error } = await updatePaymentInstructions(supabase, organization.id, parsed.instructions);
  if (error) return { error, success: false };
  revalidatePath("/dashboard/settings/payment");
  return { error: null, success: true };
}
