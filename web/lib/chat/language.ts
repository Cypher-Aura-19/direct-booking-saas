// Language handling for guest chat (AI-08, AI-09, AI-10, AI-14, AI-16).
// Pure functions only: no I/O, safe to import anywhere.

export type ChatLanguage = "en" | "ur" | "roman-ur";

const ARABIC_SCRIPT = /[؀-ۿ]/;

const ROMAN_URDU_TOKENS = new Set([
  "kya", "hai", "hain", "ka", "ki", "ke", "mein", "main", "aap", "ap",
  "kitna", "kitne", "kiraya", "raat", "kamra", "kab", "kahan", "chahiye", "milega", "hoga",
  "nahi", "nahin", "han", "haan", "ji", "bhai", "shukriya", "mujhe", "hum", "yahan",
  "wahan", "din", "kal", "aaj",
]);

// Urdu if there's any Arabic-script letter. Roman Urdu needs two *distinct*
// marker words, so a lone "haan" or "main" in an English sentence doesn't flip it.
export function detectLanguage(text: string): ChatLanguage {
  if (ARABIC_SCRIPT.test(text)) return "ur";
  const tokens = new Set(text.toLowerCase().split(/[^\p{L}]+/u).filter(Boolean));
  let hits = 0;
  for (const token of tokens) {
    if (ROMAN_URDU_TOKENS.has(token)) hits++;
  }
  return hits >= 2 ? "roman-ur" : "en";
}

export function langAttribute(lang: ChatLanguage): "en" | "ur" | "ur-Latn" {
  return lang === "roman-ur" ? "ur-Latn" : lang;
}

const HOLDING_MESSAGES: Record<ChatLanguage, string> = {
  en: "Good question — I'm checking with the host, and they'll reply here soon.",
  ur: "اچھا سوال ہے — میں میزبان سے پوچھ رہا ہوں، وہ جلد یہیں جواب دیں گے۔",
  "roman-ur": "Acha sawal hai — main host se pooch raha hoon, woh jald yahin jawab denge.",
};

export function holdingMessage(lang: ChatLanguage): string {
  return HOLDING_MESSAGES[lang];
}

const HUMAN_REQUEST_PATTERNS: readonly RegExp[] = [
  /(talk|speak|chat) (to|with) (a |an |the |your |my )?(human|person|host|owner|someone|real person)/i,
  /\b(human|real person|customer service|agent)\b/i,
  /\bcall me\b/i,
  /\b(insaan|banda|host|malik|owner)\s+(se\s+)?(baat|rabta)/i,
  /میزبان سے بات/,
  /مالک سے بات/,
  /انسان سے بات/,
];

// Deterministic pre-check (AI-14): a guest asking for a person is escalated
// without spending a model call.
export function isHumanRequest(text: string): boolean {
  return HUMAN_REQUEST_PATTERNS.some((pattern) => pattern.test(text));
}
