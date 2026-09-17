import { createOrganizationAction } from "./actions";
import { AuthLayout } from "@/components/auth/auth-layout";
import { HeroPane, ONBOARDING_STEPS } from "@/components/auth/hero-pane";
import { AuthField, AuthInput } from "@/components/auth/fields";
import { AuthButton } from "@/components/auth/auth-button";
import { Alert } from "@/components/ui/alert";

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  return (
    <AuthLayout
      hero={
        <HeroPane
          eyebrow="Step 2 of 3"
          title="Set up your organization."
          subtitle="This is your business on the platform — every property you add lives under it."
          steps={ONBOARDING_STEPS}
          activeStep={1}
        />
      }
    >
      <h1 className="text-3xl font-bold text-[#111114]">Your organization</h1>

      {error && (
        <div className="mt-4">
          <Alert tone="danger">{error}</Alert>
        </div>
      )}

      <form action={createOrganizationAction} className="mt-8 space-y-5">
        <AuthField label="Business name" htmlFor="name" hint="e.g. Hunza View Guesthouse">
          <AuthInput id="name" name="name" required autoFocus />
        </AuthField>
        <AuthField
          label="URL slug"
          htmlFor="slug"
          hint="Lowercase letters, numbers, and hyphens only — this becomes your public link."
        >
          <AuthInput id="slug" name="slug" required pattern="[a-z0-9-]+" placeholder="hunza-view" />
        </AuthField>
        <div className="grid grid-cols-2 gap-4">
          <AuthField label="Your name" htmlFor="contactName">
            <AuthInput id="contactName" name="contactName" required />
          </AuthField>
          <AuthField label="Your phone" htmlFor="contactPhone">
            <AuthInput id="contactPhone" name="contactPhone" required type="tel" />
          </AuthField>
        </div>
        <AuthButton type="submit">Continue</AuthButton>
      </form>
    </AuthLayout>
  );
}
