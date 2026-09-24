import { dashboardContext } from "../_lib/context";
import { OrganizationForm } from "./organization-form";

export default async function OrganizationSettingsPage() {
  const { organization } = await dashboardContext();
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-medium tracking-tight">Organisation</h1>
      <OrganizationForm organization={organization} />
    </div>
  );
}
