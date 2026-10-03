import type { SupabaseClient } from "@supabase/supabase-js";

export type PaymentInstructions = {
  bankName: string;
  accountTitle: string;
  accountNumber: string;
  easypaisa: string;
  jazzcash: string;
  note: string;
};

export const EMPTY_PAYMENT_INSTRUCTIONS: PaymentInstructions = {
  bankName: "", accountTitle: "", accountNumber: "", easypaisa: "", jazzcash: "", note: "",
};

const MAX_FIELD = 120;
const MAX_NOTE = 500;
const WALLET = /^\+?\d{7,15}$/;

export function parsePaymentInstructions(input: Record<string, string>): { instructions: PaymentInstructions } | { error: string } {
  const get = (key: keyof PaymentInstructions) => String(input[key] ?? "").trim();
  const instructions: PaymentInstructions = {
    bankName: get("bankName"),
    accountTitle: get("accountTitle"),
    accountNumber: get("accountNumber"),
    easypaisa: get("easypaisa").replace(/[\s-]/g, ""),
    jazzcash: get("jazzcash").replace(/[\s-]/g, ""),
    note: get("note"),
  };
  for (const key of ["bankName", "accountTitle", "accountNumber"] as const) {
    if (instructions[key].length > MAX_FIELD) return { error: `Keep each bank detail under ${MAX_FIELD} characters.` };
  }
  if (instructions.note.length > MAX_NOTE) return { error: `The note can be up to ${MAX_NOTE} characters.` };
  for (const key of ["easypaisa", "jazzcash"] as const) {
    if (instructions[key] && !WALLET.test(instructions[key])) return { error: "Easypaisa and JazzCash need a phone number, e.g. 0300 1234567." };
  }
  if (!instructions.accountNumber && !instructions.easypaisa && !instructions.jazzcash) {
    return { error: "Add at least one way to pay: a bank account number, Easypaisa or JazzCash." };
  }
  return { instructions };
}

export function readPaymentInstructions(raw: unknown): PaymentInstructions {
  const value = typeof raw === "object" && raw !== null ? (raw as Record<string, unknown>) : {};
  const text = (key: keyof PaymentInstructions) => (typeof value[key] === "string" ? (value[key] as string) : "");
  return {
    bankName: text("bankName"), accountTitle: text("accountTitle"), accountNumber: text("accountNumber"),
    easypaisa: text("easypaisa"), jazzcash: text("jazzcash"), note: text("note"),
  };
}

export async function getPaymentInstructions(supabase: SupabaseClient, organizationId: string): Promise<PaymentInstructions> {
  const { data, error } = await supabase.from("organizations").select("payment_instructions").eq("id", organizationId).maybeSingle();
  if (error) {
    if (error.code === "22P02") return EMPTY_PAYMENT_INSTRUCTIONS;
    throw error;
  }
  return readPaymentInstructions(data?.payment_instructions);
}

export async function updatePaymentInstructions(
  supabase: SupabaseClient,
  organizationId: string,
  instructions: PaymentInstructions,
): Promise<{ error: string | null }> {
  const { error } = await supabase.from("organizations").update({ payment_instructions: instructions }).eq("id", organizationId);
  return { error: error ? error.message : null };
}
