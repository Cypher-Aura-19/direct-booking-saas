import Link from "next/link";
import { notFound } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getProperty } from "@/lib/properties";
import { updatePropertyAction, togglePublishAction } from "./actions";
import { Panel } from "@/components/ui/panel";
import { Field, Input, Textarea } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/badge";
import { Alert } from "@/components/ui/alert";

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mb-1 mt-10 border-t border-border pt-8 text-xs font-semibold uppercase tracking-wider text-muted-foreground first:mt-0 first:border-t-0 first:pt-0">
      {children}
    </h2>
  );
}

export default async function PropertyDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; saved?: string }>;
}) {
  const { id } = await params;
  const { error, saved } = await searchParams;
  const supabase = await createServerSupabaseClient();
  const property = await getProperty(supabase, id);

  if (!property) notFound();

  const updateWithId = updatePropertyAction.bind(null, property.id);
  const nextStatus = property.status === "published" ? "draft" : "published";
  const toggleAction = togglePublishAction.bind(null, property.id, nextStatus);

  return (
    <div className="mx-auto max-w-2xl">
      <Link
        href="/dashboard"
        className="mb-6 inline-block text-sm font-medium text-muted-foreground hover:text-foreground"
      >
        ← Properties
      </Link>

      <div className="mb-6 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-semibold text-foreground">{property.name}</h1>
          <StatusBadge status={property.status} />
        </div>
        <form action={toggleAction}>
          <Button type="submit" variant="secondary">
            {property.status === "published" ? "Unpublish" : "Publish"}
          </Button>
        </form>
      </div>

      <Panel>
        {error && (
          <div className="mb-4">
            <Alert tone="danger">{error}</Alert>
          </div>
        )}
        {saved && (
          <div className="mb-4">
            <Alert tone="success">Saved.</Alert>
          </div>
        )}

        <form action={updateWithId} className="space-y-4">
          <SectionLabel>Basics</SectionLabel>
          <Field label="Name" htmlFor="name">
            <Input id="name" name="name" defaultValue={property.name} />
          </Field>
          <Field label="Description" htmlFor="description">
            <Textarea id="description" name="description" defaultValue={property.description ?? ""} />
          </Field>
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Address" htmlFor="address">
              <Input id="address" name="address" defaultValue={property.address ?? ""} />
            </Field>
            <Field label="City" htmlFor="city">
              <Input id="city" name="city" defaultValue={property.city ?? ""} />
            </Field>
          </div>

          <SectionLabel>Knowledge base — used by the AI agent</SectionLabel>
          <p className="text-sm text-muted-foreground">
            The AI answers guest questions only from what&apos;s written here for this property.
          </p>
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Wifi network" htmlFor="wifiNetwork">
              <Input id="wifiNetwork" name="wifiNetwork" defaultValue={property.wifi_network ?? ""} />
            </Field>
            <Field label="Wifi password" htmlFor="wifiPassword">
              <Input id="wifiPassword" name="wifiPassword" defaultValue={property.wifi_password ?? ""} />
            </Field>
          </div>
          <Field label="Gate code" htmlFor="gateCode">
            <Input id="gateCode" name="gateCode" defaultValue={property.gate_code ?? ""} />
          </Field>
          <Field label="Generator instructions" htmlFor="generatorInstructions">
            <Textarea
              id="generatorInstructions"
              name="generatorInstructions"
              defaultValue={property.generator_instructions ?? ""}
            />
          </Field>
          <Field label="Geyser instructions" htmlFor="geyserInstructions">
            <Textarea
              id="geyserInstructions"
              name="geyserInstructions"
              defaultValue={property.geyser_instructions ?? ""}
            />
          </Field>
          <Field label="AC instructions" htmlFor="acInstructions">
            <Textarea id="acInstructions" name="acInstructions" defaultValue={property.ac_instructions ?? ""} />
          </Field>
          <Field label="Parking instructions" htmlFor="parkingInstructions">
            <Textarea
              id="parkingInstructions"
              name="parkingInstructions"
              defaultValue={property.parking_instructions ?? ""}
            />
          </Field>
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Check-in time" htmlFor="checkinTime">
              <Input
                id="checkinTime"
                name="checkinTime"
                type="time"
                defaultValue={property.checkin_time ?? ""}
              />
            </Field>
            <Field label="Checkout time" htmlFor="checkoutTime">
              <Input
                id="checkoutTime"
                name="checkoutTime"
                type="time"
                defaultValue={property.checkout_time ?? ""}
              />
            </Field>
          </div>
          <Field label="Directions" htmlFor="directions">
            <Textarea id="directions" name="directions" defaultValue={property.directions ?? ""} />
          </Field>
          <Field label="Nearby recommendations" htmlFor="nearbyRecommendations">
            <Textarea
              id="nearbyRecommendations"
              name="nearbyRecommendations"
              defaultValue={property.nearby_recommendations ?? ""}
            />
          </Field>
          <Field label="House rules" htmlFor="houseRules">
            <Textarea id="houseRules" name="houseRules" defaultValue={property.house_rules ?? ""} />
          </Field>
          <Field label="Additional notes" htmlFor="additionalNotes">
            <Textarea
              id="additionalNotes"
              name="additionalNotes"
              defaultValue={property.additional_notes ?? ""}
            />
          </Field>

          <SectionLabel>Airbnb trust badge</SectionLabel>
          <Field
            label="Airbnb listing URL"
            htmlFor="airbnbListingUrl"
            hint="Verification (confirming you own this listing) is built in a later sprint — this is saved but the badge won't show as verified yet."
          >
            <Input
              id="airbnbListingUrl"
              name="airbnbListingUrl"
              defaultValue={property.airbnb_listing_url ?? ""}
            />
          </Field>

          <Button type="submit" className="w-full">
            Save changes
          </Button>
        </form>
      </Panel>
    </div>
  );
}
