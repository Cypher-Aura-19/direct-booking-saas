import Link from "next/link";
import { HostCard } from "@/components/public/host-card";
import { IconBuilding } from "@/components/ui/icons";
import { PROPERTY_TYPES, formatRupees, publicPropertyPath } from "@/lib/properties/basics";
import type { PublicOrganization, PublicPropertySummary } from "@/lib/public/catalogue";

export function propertyTypeLabel(value: string): string {
  return PROPERTY_TYPES.find((t) => t.value === value)?.label ?? value;
}

export function CatalogueView({ organization, properties }: { organization: PublicOrganization; properties: PublicPropertySummary[] }) {
  return (
    <main id="main" className="public-main">
      <header className="catalogue-hero public-wrap">
        {organization.city && <p className="public-eyebrow">{organization.city}</p>}
        <h1 className="public-display">{organization.name}</h1>
        {organization.headline && <p className="catalogue-headline">{organization.headline}</p>}
      </header>

      <section className="public-wrap" aria-label="Places to stay">
        {properties.length === 0 ? (
          <div className="public-empty">
            <IconBuilding className="size-6" />
            <p className="public-empty-title">No places are open for booking yet.</p>
            <p>{organization.name} is still getting things ready. Message them to ask about dates.</p>
          </div>
        ) : (
          <ul className="property-grid">
            {properties.map((property, index) => (
              <li key={property.id}>
                <Link href={publicPropertyPath(organization.slug, property.slug)} className="property-card">
                  <span className="property-card-media">
                    {property.cover ? (
                      // Signed Storage URLs with our own srcset: next/image would re-cache past URL expiry.
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={property.cover.src}
                        srcSet={property.cover.srcSet || undefined}
                        sizes="(min-width: 1024px) 30vw, (min-width: 640px) 45vw, 92vw"
                        alt=""
                        loading={index < 2 ? "eager" : "lazy"}
                        fetchPriority={index === 0 ? "high" : "auto"}
                        decoding="async"
                      />
                    ) : (
                      <span className="property-card-placeholder"><IconBuilding className="size-7" /></span>
                    )}
                  </span>
                  <span className="property-card-body">
                    <span className="property-card-name">{property.name}</span>
                    <span className="property-card-meta">{propertyTypeLabel(property.propertyType)} · up to {property.maxGuests} guests</span>
                    <span className="property-card-price"><strong>{formatRupees(property.baseRateCents)}</strong> / night</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="public-wrap public-section">
        <HostCard organization={organization} />
      </div>
    </main>
  );
}
