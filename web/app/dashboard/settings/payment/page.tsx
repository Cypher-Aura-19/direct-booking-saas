import { IconBuilding } from "@/components/ui/icons";
import { PageHeader, Sheet } from "@/components/ui/page-header";
import { getPaymentInstructions } from "@/lib/bookings/payment-instructions";
import { dashboardContext } from "../../_lib/context";
import { PaymentForm } from "./payment-form";

export default async function PaymentSettingsPage() {
  const { supabase, organization } = await dashboardContext();
  const instructions = await getPaymentInstructions(supabase, organization.id);
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Payment" description="How guests pay you once you approve a booking." />
      <div className="settings-content-grid">
        <aside className="settings-explainer"><span><IconBuilding /></span><h2>You collect payment yourself</h2><p>The platform never holds guest money. Add the accounts you accept; guests see them on their booking card after approval.</p></aside>
        <Sheet className="p-5 sm:p-8"><PaymentForm instructions={instructions} /></Sheet>
      </div>
    </div>
  );
}
