import { BasicsForm } from "../basics-form";
import { createPropertyAction } from "../actions";

export default function NewPropertyPage() {
  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-2xl font-medium tracking-tight">Add a property</h1>
      <BasicsForm action={createPropertyAction} submitLabel="Create property" />
    </div>
  );
}
