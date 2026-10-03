// Deterministic pre-check (PAY-05), the same shape as language.ts's
// isHumanRequest (AI-14): in stay state a guest raising refunds, cancellations
// or a new/extra charge is handed to the host without spending a model call —
// the model can't be talked into discussing money it never sees. Deliberately
// narrow: a miss is still caught by buildContext's stay-state rule line, and
// the patterns must not catch ordinary stay questions ("phone charging point",
// "extra towels").
const MONEY_PATTERNS: readonly RegExp[] = [
  /\brefunds?\b/i,
  /\bmoney\s+back\b/i,
  /\breimburs\w*/i,
  /\b(extra|additional|new|another|unexpected|hidden)\s+(charges?|fees?|payments?|bills?)\b/i,
  /\bover-?charg\w*/i,
  /\b(been|was|were|get|got)\s+charged\b/i,
  /\bcharged\s+(me|us|extra|twice|again)\b/i,
  /\bdeposits?\b/i,
  /\bpay\s+(more|extra|again)\b/i,
  /\bdiscounts?\b/i,
  /\bcancel(?:l?ation|l?ed|l?ing|s)?\b/i,
  // Roman Urdu / Urdu
  /\b(paise|paisay|raqam)\s+wapas\b/i,
  /\bwapas\s+(karo|chahiye|paise)\b/i,
  /ریفنڈ/,
  /(پیسے|رقم)\s*واپس/,
];

export function isMoneyRequest(text: string): boolean {
  return MONEY_PATTERNS.some((pattern) => pattern.test(text));
}
