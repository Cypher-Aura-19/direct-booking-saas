import Link from "next/link";
import { signUpAction } from "@/app/login/actions";
import { AuthShell } from "@/components/auth-shell";
import { Panel } from "@/components/ui/panel";
import { Field, Input } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";

export default async function SignUpPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  return (
    <AuthShell>
      <Panel>
        <h1 className="text-xl font-semibold text-foreground">Create your host account</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Takes a minute. You&apos;ll set up your first property next.
        </p>

        {error && (
          <div className="mt-4">
            <Alert tone="danger">{error}</Alert>
          </div>
        )}

        <form action={signUpAction} className="mt-6 space-y-4">
          <Field label="Email" htmlFor="email">
            <Input id="email" name="email" type="email" required autoComplete="email" />
          </Field>
          <Field label="Password" htmlFor="password" hint="At least 6 characters.">
            <Input
              id="password"
              name="password"
              type="password"
              required
              minLength={6}
              autoComplete="new-password"
            />
          </Field>
          <Button type="submit" className="w-full">
            Create account
          </Button>
        </form>

        <p className="mt-6 text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link href="/login" className="font-medium text-primary hover:underline">
            Log in
          </Link>
        </p>
      </Panel>
    </AuthShell>
  );
}
