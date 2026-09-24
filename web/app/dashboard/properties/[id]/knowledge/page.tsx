import { dashboardContext } from "../../../_lib/context";
import { getKnowledgeBase } from "@/lib/properties/knowledge-base";
import { updateKnowledgeBaseAction } from "../../actions";
import { KnowledgeForm } from "./knowledge-form";

export default async function PropertyKnowledgePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase } = await dashboardContext();
  const knowledgeBase = (await getKnowledgeBase(supabase, id)) ?? {};

  return <KnowledgeForm action={updateKnowledgeBaseAction.bind(null, id)} knowledgeBase={knowledgeBase} />;
}
