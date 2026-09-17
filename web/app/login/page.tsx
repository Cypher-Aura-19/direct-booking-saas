import Link from "next/link";
import { signInAction } from "./actions";
import { AuthShell } from "@/components/auth-shell";
import { Panel } from "@/components/ui/panel";
import { Field, Input } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  return (
    <AuthShell>
      <Panel>
        <h1 className="text-xl font-semibold text-foreground">Log in</h1>
        <p className="mt-1 text-sm text-muted-foreground">Welcome back.</p>

        {error && (
          <div className="mt-4">
            <Alert tone="danger">{error}</Alert>
          </div>
        )}

        <form action={signInAction} className="mt-6 space-y-4">
          <Field label="Email" htmlFor="email">
            <Input id="email" name="email" type="email" required autoComplete="email" />
          </Field>
          <Field label="Password" htmlFor="password">
            <Input
              id="password"
              name="password"
              type="password"
              required
              autoComplete="current-password"
            />
          </Field>
          <Button type="submit" className="w-full">
            Log in
          </Button>
        </form>

        <p className="mt-6 text-sm text-muted-foreground">
          New here?{" "}
          <Link href="/signup" className="font-medium text-primary hover:underline">
            Create an account
          </Link>
        </p>
      </Panel>
    </AuthShell>
  );
}
