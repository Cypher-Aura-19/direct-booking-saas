import { PageHeader, Sheet } from "@/components/ui/page-header";
import { BasicsForm } from "../basics-form";
import { createPropertyAction } from "../actions";

export default function NewPropertyPage() {
  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        back={{ href: "/dashboard/properties", label: "Properties" }}
        title="Add a property"
        description="Just the minimum to exist. You add photos next, then the details your AI assistant answers from."
      />
      <Sheet className="p-5 sm:p-8">
        <BasicsForm action={createPropertyAction} submitLabel="Create property" />
      </Sheet>
    </div>
  );
}
