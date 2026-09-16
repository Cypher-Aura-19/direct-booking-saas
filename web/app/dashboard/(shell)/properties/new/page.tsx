import Link from "next/link";
import { createPropertyAction } from "./actions";
import { Panel } from "@/components/ui/panel";
import { Field, Input, Textarea } from "@/components/ui/field";
import { Button } from "@/components/ui/button";

export default async function NewPropertyPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  return (
    <div className="mx-auto max-w-2xl">
      <Link
        href="/dashboard"
        className="mb-6 inline-block text-sm font-medium text-muted-foreground hover:text-foreground"
      >
        ← Properties
      </Link>

      <Panel>
        <h1 className="font-display text-2xl font-medium text-foreground">New property</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Start with the basics — you&apos;ll fill in wifi, house rules, and directions next.
        </p>

        {error && (
          <p className="mt-4 rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>
        )}

        <form action={createPropertyAction} className="mt-6 space-y-5">
          <Field label="Property name" htmlFor="name">
            <Input id="name" name="name" required autoFocus placeholder="Deluxe Cabin" />
          </Field>
          <Field label="URL slug" htmlFor="slug" hint="Used in the public property link.">
            <Input id="slug" name="slug" required pattern="[a-z0-9-]+" placeholder="deluxe-cabin" />
          </Field>
          <Field label="Description" htmlFor="description">
            <Textarea id="description" name="description" placeholder="What makes this place worth staying at?" />
          </Field>
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Address" htmlFor="address">
              <Input id="address" name="address" />
            </Field>
            <Field label="City" htmlFor="city">
              <Input id="city" name="city" placeholder="Hunza" />
            </Field>
          </div>
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Max guests" htmlFor="maxGuests">
              <Input id="maxGuests" name="maxGuests" type="number" required min={1} />
            </Field>
            <Field label="Nightly rate (PKR)" htmlFor="nightlyRatePkr">
              <Input id="nightlyRatePkr" name="nightlyRatePkr" type="number" required min={0} />
            </Field>
          </div>
          <Button type="submit" className="w-full">
            Create property
          </Button>
        </form>
      </Panel>
    </div>
  );
}
