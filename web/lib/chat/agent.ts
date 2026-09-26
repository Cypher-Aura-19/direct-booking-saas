import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  GUEST_MESSAGES_PER_DAY,
  addMessage,
  escalate,
  getConversation,
  guestMessagesToday,
  parseGuestMessage,
  type ChatMessage,
  type Conversation,
  type Sender,
} from "./conversations";
import { buildContext } from "./context";
import { detectLanguage, holdingMessage, isHumanRequest } from "./language";
import type { ChatModel, ModelMessage } from "./model";
import { TOOL_DECLARATIONS, parseRespondArgs, runCheckStay, type RespondArgs } from "./tools";

// The guest turn (spec §5; AI-06, AI-07, AI-11 to AI-16, SEC-08). The order of
// the steps below is load-bearing: nothing is stored before the token, the
// message and the rate cap check out; the model is never called in payment
// state, with the AI switched off, or for a request for a human; and no model
// reply reaches the database before it has been scanned for withheld values.

export type TurnResult = { messages: ChatMessage[]; escalated: boolean };

const HISTORY_LIMIT = 20;
const MAX_ROUNDS = 3;
const RATE_CAP_ERROR = "You've sent a lot of messages. The host will reply here soon.";

// A secret compared with everything but letters and digits stripped, so
// "A GATE 4412" or "a.gate.4412" still count as "A-GATE-4412". Only for
// values long enough that the stripped form can't plausibly occur by chance
// (a 3-digit code stripped would match inside any price).
const MIN_NORMALISED_LENGTH = 6;

function normalise(value: string): string {
  return value.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");
}

export function containsWithheld(reply: string, withheld: string[]): boolean {
  const lower = reply.toLowerCase();
  const stripped = normalise(reply);
  return withheld.some((raw) => {
    const value = raw.trim();
    if (value.length < 3) return false;
    if (lower.includes(value.toLowerCase())) return true;
    const normalised = normalise(value);
    return normalised.length >= MIN_NORMALISED_LENGTH && stripped.includes(normalised);
  });
}

async function recentHistory(service: SupabaseClient, conversationId: string): Promise<ModelMessage[]> {
  const { data, error } = await service
    .from("messages")
    .select("sender, body, created_at")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(HISTORY_LIMIT);
  if (error) throw error;
  return (data ?? []).reverse().map((row): ModelMessage => {
    const sender = row.sender as Sender;
    if (sender === "guest") return { role: "user", text: row.body };
    return { role: "model", text: sender === "host" ? `Host: ${row.body}` : row.body };
  });
}

// A `respond` with an empty reply is the model's legitimate "I don't know,
// hand this to the host" signal (brief AI-13 test), but parseRespondArgs
// rejects empty replies. Accept exactly that shape here: escalate: true, a
// blank reply and a valid (or missing) reason. Everything else still goes
// through parseRespondArgs untouched.
function parseRespond(args: unknown): RespondArgs | null {
  const parsed = parseRespondArgs(args);
  if (parsed) return parsed;
  if (typeof args !== "object" || args === null) return null;
  const value = args as Record<string, unknown>;
  if (value.escalate !== true || typeof value.reply !== "string" || value.reply.trim() !== "") return null;
  const probe = parseRespondArgs({ ...value, reply: "x" });
  return probe ? { ...probe, reply: "" } : null;
}

type Outcome = { respond: RespondArgs } | { escalate: "model_error" };

async function runModel(
  service: SupabaseClient,
  model: ChatModel,
  conversation: Conversation,
  system: string,
  history: ModelMessage[],
  today: string,
): Promise<Outcome> {
  for (let round = 0; round < MAX_ROUNDS; round++) {
    // A copy per call, so a recorded call is a snapshot of what was sent.
    const turn = await model.next(system, [...history], TOOL_DECLARATIONS);
    if ("error" in turn) return { escalate: "model_error" };

    const { name, args } = turn.toolCall;
    if (name === "check_stay") {
      const result = await runCheckStay(service, conversation.propertyId, args, today);
      history.push({ role: "model", toolCall: { name, args } }, { role: "tool", name, result });
      continue;
    }
    if (name === "respond") {
      const respond = parseRespond(args);
      return respond ? { respond } : { escalate: "model_error" };
    }
    return { escalate: "model_error" };
  }
  return { escalate: "model_error" };
}

export async function runGuestTurn(opts: {
  service: SupabaseClient;
  model: ChatModel | null;
  token: string;
  text: string;
  today: string;
}): Promise<TurnResult | { error: string }> {
  const { service, model, token, text, today } = opts;

  // 1. The token is the credential.
  const conversation = await getConversation(service, token);
  if (!conversation) return { error: "This chat link is not valid." };

  // 2. Validate before anything is stored.
  const parsed = parseGuestMessage(text);
  if ("error" in parsed) return parsed;
  const { body } = parsed;

  // 3. Rate cap, before storing.
  if ((await guestMessagesToday(service, conversation.id)) >= GUEST_MESSAGES_PER_DAY) {
    return { error: RATE_CAP_ERROR };
  }

  // 4. Store the guest's message.
  const guest = await addMessage(service, conversation.id, "guest", body);

  // 5. Payment state or AI switched off: the AI stays silent (SEC-08). The
  // DB trigger on messages is the backstop for payment state.
  if (conversation.aiState === "payment" || !conversation.aiEnabled) {
    return { messages: [guest], escalated: conversation.escalated };
  }

  // 6.
  const lang = detectLanguage(body);

  const handOff = async (reason: string): Promise<TurnResult> => {
    await escalate(service, conversation.id, reason);
    const holding = await addMessage(service, conversation.id, "ai", holdingMessage(lang));
    return { messages: [guest, holding], escalated: true };
  };

  // 7. A request for a person never reaches the model (AI-14).
  if (isHumanRequest(body)) return handOff("human");

  // 8. No API key configured.
  if (!model) return handOff("no_model");

  // 9–10. Grounded context from this conversation's own property only, then
  // the bounded tool loop. Any failure in here (a thrown DB error included)
  // is a model_error hand-off rather than a guest left without a reply.
  let outcome: Outcome;
  let withheld: string[];
  try {
    const context = await buildContext(service, conversation, lang, today);
    withheld = context.withheld;
    const history = await recentHistory(service, conversation.id);
    outcome = await runModel(service, model, conversation, context.systemPrompt, history, today);
  } catch {
    return handOff("model_error");
  }
  if ("escalate" in outcome) return handOff(outcome.escalate);
  const { reply, escalate: wantsEscalation, escalation_reason } = outcome.respond;

  // 11. Post-check: nothing that was withheld from the prompt may leave in a
  // reply. Logged by conversation id only — never the value or the reply.
  const blank = reply.trim() === "";
  if (containsWithheld(reply, withheld) || (blank && !wantsEscalation)) {
    if (!blank) console.warn(`[chat] reply blocked by leak scan in conversation ${conversation.id}`);
    return handOff("leak_blocked");
  }

  // 12. Model-requested escalation. The reply is stored before escalating;
  // a blank reply or a money question gets the holding message instead.
  if (wantsEscalation) {
    const reason = escalation_reason ?? "unknown";
    const text = blank || reason === "money" ? holdingMessage(lang) : reply;
    const stored = await addMessage(service, conversation.id, "ai", text);
    await escalate(service, conversation.id, reason);
    return { messages: [guest, stored], escalated: true };
  }

  // 13.
  const stored = await addMessage(service, conversation.id, "ai", reply);
  return { messages: [guest, stored], escalated: conversation.escalated };
}
