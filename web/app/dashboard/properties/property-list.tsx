import { formatRupees, publicPropertyPath, type PropertySummary } from "@/lib/properties/basics";

export function PropertyList({
  organizationSlug,
  properties,
}: {
  organizationSlug: string;
  properties: PropertySummary[];
}) {
  if (properties.length === 0) {
    return (
      <p className="max-w-md text-muted">
        Add your first property. You only need a name, an address and a nightly rate — photos and the
        details your AI assistant answers from can come after.
      </p>
    );
  }

  return (
    <ul className="flex flex-col divide-y divide-hairline border-y border-hairline">
      {properties.map((property) => (
        <li key={property.id} className="flex flex-wrap items-center justify-between gap-4 py-4">
          <div className="flex flex-col gap-1">
            <a href={`/dashboard/properties/${property.id}`} className="font-medium text-ink hover:underline">
              {property.name}
            </a>
            <span className="text-sm text-muted">
              {formatRupees(property.base_rate_cents)} / night · up to {property.max_guests} guests
            </span>
          </div>
          <div className="flex items-center gap-4 text-sm">
            <span className={property.published ? "text-success" : "text-muted"}>
              {property.published ? "Published" : "Draft"}
            </span>
            {property.published && (
              <a
                href={publicPropertyPath(organizationSlug, property.slug)}
                className="flex min-h-11 items-center text-ink underline"
              >
                View public page
              </a>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}
