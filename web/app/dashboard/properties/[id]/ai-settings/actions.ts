"use server";

import { dashboardContext } from "../../../_lib/context";
import { parseAiSettings } from "@/lib/properties/ai-settings";
import { runTestTurn, type TestTurn } from "@/lib/chat/test-chat";
import { modelFromEnv } from "@/lib/chat/model";
import { localToday } from "@/lib/dashboard/analytics";

// The host's own test chat (AIC-14). Uses the host's authenticated
// `supabase` client from dashboardContext(), never the service-role client —
// RLS's existing owns_property policy is what actually scopes this to the
// host's own properties, the same as every other dashboard action.
const GENERIC_ERROR = "Something went wrong. Please try again.";

export async function testAiReplyAction(
  propertyId: string,
  settingsFormData: FormData,
  history: TestTurn[],
  message: string,
): Promise<{ reply: string; escalated: boolean } | { error: string }> {
  const parsed = parseAiSettings(Object.fromEntries(settingsFormData));
  if (!parsed.ok) return { error: parsed.error };
  const { supabase } = await dashboardContext();
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
