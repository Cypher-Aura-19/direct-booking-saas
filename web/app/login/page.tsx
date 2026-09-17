import Link from "next/link";
import { signInAction } from "./actions";
import { AuthLayout } from "@/components/auth/auth-layout";
import { HeroPane } from "@/components/auth/hero-pane";
import { AuthField, AuthInput } from "@/components/auth/fields";
import { AuthButton } from "@/components/auth/auth-button";
import { Alert } from "@/components/ui/alert";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  return (
    <AuthLayout
      hero={
        <HeroPane
          eyebrow="Welcome back"
          title="Pick up right where you left off."
          subtitle="Your properties, bookings, and guests are exactly as you left them."
        />
      }
    >
      <h1 className="text-3xl font-bold text-[#111114]">Log in</h1>

      {error && (
        <div className="mt-4">
          <Alert tone="danger">{error}</Alert>
        </div>
      )}

      <form action={signInAction} className="mt-8 space-y-5">
        <AuthField label="Email" htmlFor="email">
          <AuthInput id="email" name="email" type="email" required autoComplete="email" />
        </AuthField>
        <AuthField label="Password" htmlFor="password">
          <AuthInput
            id="password"
            name="password"
            type="password"
            required
            autoComplete="current-password"
          />
        </AuthField>
        <AuthButton type="submit">Continue</AuthButton>
      </form>

      <p className="mt-6 text-center text-sm text-[#6B6E76]">
        New here?{" "}
        <Link href="/signup" className="font-semibold text-[#2547c9] hover:underline">
          Create an account
        </Link>
      </p>
    </AuthLayout>
  );
}
