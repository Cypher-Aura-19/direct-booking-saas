import type { AiSwitches } from "../properties/ai-settings";
import { detectLanguage } from "./language";

export type DeclinableTopic = "answer_house_rules" | "give_directions" | "recommend_nearby" | "take_booking_requests";

// Deterministic keyword sets (AIC-11), the same shape as language.ts's
// isHumanRequest: a guest asking about a topic the host switched off is
// declined without spending a model call. Deliberately narrow — a miss here
// still gets caught by buildContext's per-switch rule line and, if the model
// answers anyway, by violatesDisabledCapability below.
const TOPIC_PATTERNS: Record<DeclinableTopic, RegExp[]> = {
  answer_house_rules: [
    /\bhouse\s*rules?\b/i,
    /\bpolic(?:y|ies)\b/i,
    /\b(pets?|smoking|parties|noise)\s+allowed\b/i,
    /\bcan\s+i\s+(smoke|bring\s+(a\s+)?pet|throw\s+a\s+party)\b/i,
  ],
  give_directions: [
    /\bdirections?\b/i,
    /\bhow\s+(do|to)\s+(i|we)\s+(get|reach)\b/i,
    /\bhow\s+to\s+reach\b/i,
    /\bwhat'?s\s+the\s+address\b/i,
    /\broute\s+to\b/i,
  ],
  recommend_nearby: [
    /\brestaurants?\s+nearby\b/i,
    /\bnearby\s+(restaurants?|attractions?|places?)\b/i,
    /\bthings?\s+to\s+do\b/i,
    /\btourist\s+spots?\b/i,
    /\bwhere\s+(can|should)\s+i\s+eat\b/i,
  ],
  take_booking_requests: [
    /\bi\s+want\s+to\s+book\b/i,
    /\bbook\s+(this|these\s+dates|it|now)\b/i,
    /\breserve\s+(this|these\s+dates)\b/i,
    /\bconfirm\s+(my|the|a)\s+(booking|reservation)\b/i,
    /\bhold\s+these\s+dates\b/i,
  ],
};

function matchDisabledTopic(text: string, switches: AiSwitches): DeclinableTopic | null {
  for (const topic of Object.keys(TOPIC_PATTERNS) as DeclinableTopic[]) {
    if (switches[topic]) continue;
    if (TOPIC_PATTERNS[topic].some((pattern) => pattern.test(text))) return topic;
  }
  return null;
}

export function disabledCapabilityRequested(body: string, switches: AiSwitches): DeclinableTopic | null {
  return matchDisabledTopic(body, switches);
}

// Post-check (AIC-12): even if the model ignored buildContext's rule line, a
// reply that talks about a topic the host switched off never reaches the
// guest — same keyword sets, run against the reply instead of the question.
export function violatesDisabledCapability(reply: string, switches: AiSwitches): boolean {
  return matchDisabledTopic(reply, switches) !== null;
}

// Defense in depth for the answer_urdu switch: when it's off, buildContext
// only ever instructs the model in English, so any reply detectLanguage
// still calls Urdu or Roman Urdu means the model didn't comply.
export function languageViolation(reply: string, switches: AiSwitches): boolean {
  return !switches.answer_urdu && detectLanguage(reply) !== "en";
}
