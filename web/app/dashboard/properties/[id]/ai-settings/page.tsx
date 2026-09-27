import { dashboardContext } from "../../../_lib/context";
import { getAiSettings, DEFAULT_AI_SETTINGS } from "@/lib/properties/ai-settings";
import { updateAiSettingsAction } from "../../actions";
import { AiSettingsForm } from "./ai-settings-form";
import { TestChatPanel } from "./test-chat-panel";

export default async function PropertyAiSettingsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase } = await dashboardContext();
  const settings = (await getAiSettings(supabase, id)) ?? DEFAULT_AI_SETTINGS;

  return (
    <div className="flex flex-col gap-6">
      <AiSettingsForm action={updateAiSettingsAction.bind(null, id)} settings={settings} />
      <TestChatPanel propertyId={id} />
    </div>
  );
}
