"use server";

import { dashboardContext } from "../../../_lib/context";
import { parseAiSettings } from "@/lib/properties/ai-settings";
import { runTestTurn, TEST_CHAT_HISTORY_LIMIT, type TestTurn } from "@/lib/chat/test-chat";
import { MAX_GUEST_MESSAGE } from "@/lib/chat/conversations";
import { modelFromEnv } from "@/lib/chat/model";
import { localToday } from "@/lib/dashboard/analytics";

// The host's own test chat (AIC-14). Uses the host's authenticated
// `supabase` client from dashboardContext(), never the service-role client —
// RLS's existing owns_property policy is what actually scopes this to the
// host's own properties, the same as every other dashboard action.
const GENERIC_ERROR = "Something went wrong. Please try again.";

// `history` and `message` cross a network-ish boundary from the client (a
// Server Action argument, not a typechecked in-process call) and are not
// trustworthy at runtime even though the TS signature already shapes them —
// the same reasoning sendMessageAction (web/app/s/[org]/[property]/chat/actions.ts)
// already applies to its own `text` parameter.
function isValidHistory(history: unknown): history is TestTurn[] {
  if (!Array.isArray(history) || history.length > TEST_CHAT_HISTORY_LIMIT) return false;
  return history.every(
    (turn): turn is TestTurn =>
      typeof turn === "object" &&
      turn !== null &&
      (turn as { role: unknown }).role !== undefined &&
      ((turn as { role: unknown }).role === "guest" || (turn as { role: unknown }).role === "ai") &&
      typeof (turn as { text: unknown }).text === "string" &&
      (turn as { text: string }).text.length <= MAX_GUEST_MESSAGE,
  );
}

export async function testAiReplyAction(
  propertyId: string,
  settingsFormData: FormData,
  history: TestTurn[],
  message: string,
): Promise<{ reply: string; escalated: boolean } | { error: string }> {
  const { supabase } = await dashboardContext();

  if (!isValidHistory(history)) return { error: GENERIC_ERROR };
  if (typeof message !== "string") return { error: GENERIC_ERROR };

  const parsed = parseAiSettings(Object.fromEntries(settingsFormData));
  if (!parsed.ok) return { error: parsed.error };
  try {
    return await runTestTurn({
      service: supabase,
      model: modelFromEnv(),
      propertyId,
      settings: parsed.value,
      history,
      message,
      today: localToday(),
    });
  } catch {
    console.error("[ai-settings] test chat turn failed");
    return { error: GENERIC_ERROR };
  }
}
