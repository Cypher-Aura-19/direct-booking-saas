import { notFound } from "next/navigation";
import { dashboardContext } from "../../../_lib/context";
import { getProperty } from "@/lib/properties/basics";
import { getStaySettings, listSeasonalRules } from "@/lib/availability/pricing";
import { localToday } from "@/lib/dashboard/analytics";
import { Sheet, SheetHeader } from "@/components/ui/page-header";
import { createSeasonalRuleAction, updateStaySettingsAction } from "../../actions";
import { SettingsForm } from "./settings-form";
import { RulesSection } from "./rules-section";

export default async function PropertyPricingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase } = await dashboardContext();
  const property = await getProperty(supabase, id);
  if (!property) notFound();
  const settings = (await getStaySettings(supabase, id)) ?? { minimumStay: 1, advancePercent: 30 };
  const rules = await listSeasonalRules(supabase, id);
  const today = localToday();

  return (
    <div className="flex flex-col gap-6">
      <Sheet>
        <SheetHeader title="Stay rules" description="Apply to every booking unless a seasonal rate says otherwise." />
        <div className="p-5 sm:p-6">
          <SettingsForm action={updateStaySettingsAction.bind(null, id)} settings={settings} />
        </div>
      </Sheet>

      <Sheet>
        <SheetHeader
          title="Seasonal rates"
          description="Charge a different nightly rate for busy seasons like Eid, summer or New Year."
        />
        <RulesSection
          action={createSeasonalRuleAction.bind(null, id)}
          propertyId={id}
          rules={rules}
          baseRateCents={property.base_rate_cents}
          today={today}
        />
      </Sheet>
    </div>
  );
}
