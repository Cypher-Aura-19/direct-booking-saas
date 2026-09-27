import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { containsWithheld, runModel } from "./agent";
import { buildContext } from "./context";
import { detectLanguage, holdingMessage, isHumanRequest } from "./language";
import { disabledCapabilityRequested, violatesDisabledCapability, languageViolation } from "./capabilities";
import { parseGuestMessage, type Conversation } from "./conversations";
import type { ChatModel, ModelMessage } from "./model";
import type { AiSettings } from "../properties/ai-settings";

// A host trying out their own AI settings before saving them (AIC-14). This
// deliberately never touches `conversations` or `messages` — nothing here is
// persisted, polled, or ever visible in the host inbox (M9). It mirrors the
// enforcement order in agent.ts's runGuestTurn (its steps 6-11), but stays a
// fully separate function on purpose: a bug in this test harness must never
// be able to read or write a real guest conversation.

export type TestTurn = { role: "guest" | "ai"; text: string };

export const TEST_CHAT_HISTORY_LIMIT = 12;

const TOO_LONG_ERROR = "This test conversation is getting long — reset it to start a fresh one.";

export async function runTestTurn(opts: {
  service: SupabaseClient;
  model: ChatModel | null;
  propertyId: string;
  settings: AiSettings;
  history: TestTurn[];
  message: string;
  today: string;
}): Promise<{ reply: string; escalated: boolean } | { error: string }> {
  const { service, model, propertyId, settings, history, message, today } = opts;

  const parsed = parseGuestMessage(message);
  if ("error" in parsed) return parsed;
  if (history.length >= TEST_CHAT_HISTORY_LIMIT) return { error: TOO_LONG_ERROR };

  const conversation: Conversation = { id: "test-chat", propertyId, aiState: "enquiry", aiEnabled: true, escalated: false };
  const detected = detectLanguage(parsed.body);
  const lang = settings.switches.answer_urdu ? detected : "en";

  if (isHumanRequest(parsed.body)) return { reply: holdingMessage(lang), escalated: true };
  if (disabledCapabilityRequested(parsed.body, settings.switches)) return { reply: holdingMessage(lang), escalated: true };
  if (!model) return { reply: holdingMessage(lang), escalated: true };

  const modelHistory: ModelMessage[] = history.map((turn) =>
    turn.role === "guest" ? { role: "user", text: turn.text } : { role: "model", text: turn.text },
  );
  modelHistory.push({ role: "user", text: parsed.body });

  let outcome: Awaited<ReturnType<typeof runModel>>;
  let withheld: string[];
  try {
    const context = await buildContext(service, conversation, lang, today, settings);
    withheld = context.withheld;
    outcome = await runModel(service, model, conversation, context.systemPrompt, modelHistory, today, settings);
  } catch {
    return { reply: holdingMessage(lang), escalated: true };
  }
  if ("escalate" in outcome) return { reply: holdingMessage(lang), escalated: true };

  const { reply, escalate: wantsEscalation, escalation_reason } = outcome.respond;
  const blank = reply.trim() === "";
  const violation = violatesDisabledCapability(reply, settings.switches) || languageViolation(reply, settings.switches);
  if (containsWithheld(reply, withheld) || (blank && !wantsEscalation) || violation) {
    return { reply: holdingMessage(lang), escalated: true };
  }
  if (wantsEscalation) {
    const text = blank || escalation_reason === "money" ? holdingMessage(lang) : reply;
    return { reply: text, escalated: true };
  }
  return { reply, escalated: false };
}
