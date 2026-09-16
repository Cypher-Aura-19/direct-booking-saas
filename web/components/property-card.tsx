import Link from "next/link";
import type { Property } from "@/lib/properties";
import { StatusBadge } from "@/components/ui/badge";

export function PropertyCard({ property }: { property: Property }) {
  return (
    <Link
      href={`/dashboard/properties/${property.id}`}
      className="group relative block overflow-hidden rounded-xl border border-border bg-surface p-6 pl-7 shadow-sm shadow-pine/5 transition-shadow hover:shadow-md hover:shadow-pine/10"
    >
      <span
        className={`absolute inset-y-0 left-0 w-1 ${
          property.status === "published" ? "bg-primary" : "bg-accent"
        }`}
        aria-hidden
      />
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-display text-lg font-medium text-foreground group-hover:text-primary">
            {property.name}
          </h3>
          <p className="mt-1 font-mono text-sm text-muted-foreground">
            {property.max_guests} guests · Rs {property.nightly_rate_pkr.toLocaleString()}/night
          </p>
        </div>
        <StatusBadge status={property.status} />
      </div>
    </Link>
  );
}
