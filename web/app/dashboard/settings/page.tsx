import { IconBuilding } from "@/components/ui/icons";
import { PageHeader, Sheet } from "@/components/ui/page-header";
import { dashboardContext } from "../_lib/context";
import { OrganizationForm } from "./organization-form";

export default async function OrganizationSettingsPage() {
  const { organization } = await dashboardContext();
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Organisation" description="How your business appears at the top of your public catalogue." />
      <div className="settings-content-grid">
      <aside className="settings-explainer"><span><IconBuilding /></span><h2>Your business identity</h2><p>Keep your guest-facing details up to date. Your business name and headline appear on your public catalogue.</p></aside>
      <Sheet className="p-5 sm:p-8">
        <OrganizationForm organization={organization} />
      </Sheet>
      </div>
    </div>
  );
}
