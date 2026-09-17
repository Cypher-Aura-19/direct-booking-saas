import Link from "next/link";
import type { Property } from "@/lib/properties";
import { StatusBadge } from "@/components/ui/badge";

export function PropertyCard({ property }: { property: Property }) {
  return (
    <Link
      href={`/dashboard/properties/${property.id}`}
      className="block rounded-xl border border-border bg-surface p-5 transition-shadow hover:shadow-sm"
    >
      <div className="flex items-start justify-between gap-3">
        <h3 className="font-medium text-foreground">{property.name}</h3>
        <StatusBadge status={property.status} />
      </div>
      <p className="mt-1.5 font-mono text-sm text-muted-foreground">
        {property.max_guests} guests · Rs {property.nightly_rate_pkr.toLocaleString()}/night
      </p>
    </Link>
  );
}
