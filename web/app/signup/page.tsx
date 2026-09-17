import Link from "next/link";
import { signUpAction } from "@/app/login/actions";
import { AuthLayout } from "@/components/auth/auth-layout";
import { HeroPane, ONBOARDING_STEPS } from "@/components/auth/hero-pane";
import { AuthField, AuthInput } from "@/components/auth/fields";
import { AuthButton } from "@/components/auth/auth-button";
import { Alert } from "@/components/ui/alert";

export default async function SignUpPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  return (
    <AuthLayout
      hero={
        <HeroPane
          eyebrow="Join as a host 🏔️"
          title="Start taking bookings directly."
          subtitle="Follow these steps to get your first property live."
          steps={ONBOARDING_STEPS}
          activeStep={0}
        />
      }
    >
      <h1 className="text-3xl font-bold text-[#111114]">Create your account</h1>

      {error && (
        <div className="mt-4">
          <Alert tone="danger">{error}</Alert>
        </div>
      )}

      <form action={signUpAction} className="mt-8 space-y-5">
        <AuthField label="Email" htmlFor="email">
          <AuthInput id="email" name="email" type="email" required autoComplete="email" />
        </AuthField>
        <AuthField label="Password" htmlFor="password" hint="At least 6 characters.">
          <AuthInput
            id="password"
            name="password"
            type="password"
            required
            minLength={6}
            autoComplete="new-password"
          />
        </AuthField>
        <AuthButton type="submit">Continue</AuthButton>
      </form>

      <p className="mt-6 text-center text-sm text-[#6B6E76]">
        Already have an account?{" "}
        <Link href="/login" className="font-semibold text-[#2547c9] hover:underline">
          Log in
        </Link>
      </p>

      <p className="mt-6 text-center text-xs text-[#9AA0AC]">
        By continuing you agree to how this platform handles your data and your guests&apos;.
      </p>
    </AuthLayout>
  );
}
