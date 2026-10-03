// @vitest-environment node
import { test, expect } from "vitest";
import { createTestHostWithOrg } from "@/tests/helpers";
import { EMPTY_PAYMENT_INSTRUCTIONS, getPaymentInstructions, parsePaymentInstructions, readPaymentInstructions, updatePaymentInstructions } from "./payment-instructions";

test("parsePaymentInstructions needs at least one way to pay and bounds every field", () => {
  expect(parsePaymentInstructions({})).toMatchObject({ error: expect.any(String) });
  const ok = parsePaymentInstructions({ bankName: " HBL ", accountTitle: "Hunza Stays", accountNumber: "1234 5678 9012", easypaisa: "0300-1234567", jazzcash: "", note: "Send the receipt here." });
  expect(ok).toEqual({
    instructions: { bankName: "HBL", accountTitle: "Hunza Stays", accountNumber: "1234 5678 9012", easypaisa: "03001234567", jazzcash: "", note: "Send the receipt here." },
  });
  expect(parsePaymentInstructions({ easypaisa: "abc" })).toMatchObject({ error: expect.any(String) });
  expect(parsePaymentInstructions({ jazzcash: "03001234567", note: "x".repeat(501) })).toMatchObject({ error: expect.any(String) });
  expect(parsePaymentInstructions({ accountNumber: "1".repeat(121) })).toMatchObject({ error: expect.any(String) });
});

test("readPaymentInstructions tolerates empty or malformed stored values", () => {
  expect(readPaymentInstructions({})).toEqual(EMPTY_PAYMENT_INSTRUCTIONS);
  expect(readPaymentInstructions(null)).toEqual(EMPTY_PAYMENT_INSTRUCTIONS);
  expect(readPaymentInstructions({ easypaisa: 5, bankName: "HBL" })).toEqual({ ...EMPTY_PAYMENT_INSTRUCTIONS, bankName: "HBL" });
});

test("a host saves and reads back their payment instructions; another org never sees them", async () => {
  const a = await createTestHostWithOrg();
  const b = await createTestHostWithOrg();
  const parsed = parsePaymentInstructions({ easypaisa: "03001234567" });
  if (!("instructions" in parsed)) throw new Error("expected ok");
  expect(await updatePaymentInstructions(a.supabase, a.organizationId, parsed.instructions)).toEqual({ error: null });
  expect((await getPaymentInstructions(a.supabase, a.organizationId)).easypaisa).toBe("03001234567");
  expect(await getPaymentInstructions(b.supabase, a.organizationId)).toEqual(EMPTY_PAYMENT_INSTRUCTIONS);
  await a.cleanup();
  await b.cleanup();
});
