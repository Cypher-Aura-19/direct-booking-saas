import { createOrganizationAction } from "./actions";
import { Panel } from "@/components/ui/panel";
import { Field, Input } from "@/components/ui/field";
import { Button } from "@/components/ui/button";

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  return (
    <main className="flex min-h-dvh items-center justify-center px-6 py-16">
      <div className="w-full max-w-lg">
        <div className="mb-6 flex items-center gap-2">
          <span className="h-1.5 w-8 rounded-full bg-primary" />
          <span className="h-1.5 w-8 rounded-full bg-stone" />
          <span className="ml-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Step 1 of 2 — Your organization
          </span>
        </div>

        <Panel>
          <h1 className="font-display text-2xl font-medium text-foreground">
            Set up your organization
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            This is your business on the platform — one or more properties live under it.
          </p>

          {error && (
            <p className="mt-4 rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>
          )}

          <form action={createOrganizationAction} className="mt-6 space-y-5">
            <Field label="Business name" htmlFor="name" hint="e.g. Hunza View Guesthouse">
              <Input id="name" name="name" required autoFocus />
            </Field>
            <Field
              label="URL slug"
              htmlFor="slug"
              hint="Lowercase letters, numbers, and hyphens only — this becomes your public link."
            >
              <Input id="slug" name="slug" required pattern="[a-z0-9-]+" placeholder="hunza-view" />
            </Field>
            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="Your name" htmlFor="contactName">
                <Input id="contactName" name="contactName" required />
              </Field>
              <Field label="Your phone" htmlFor="contactPhone">
                <Input id="contactPhone" name="contactPhone" required type="tel" />
              </Field>
            </div>
            <Button type="submit" className="w-full">
              Continue
            </Button>
          </form>
        </Panel>
      </div>
    </main>
  );
}
