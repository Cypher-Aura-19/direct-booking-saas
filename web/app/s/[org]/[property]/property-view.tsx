import Link from "next/link";
import { HostCard } from "@/components/public/host-card";
import { buttonClasses } from "@/components/ui/button";
import { IconArrowLeft, IconCheck, IconChat, IconPhoto, IconUser } from "@/components/ui/icons";
import { formatRupees } from "@/lib/properties/basics";
import { amenityLabel } from "@/lib/properties/listing";
import { whatsappLink, type PublicOrganization, type PublicProperty } from "@/lib/public/catalogue";
import { propertyTypeLabel } from "../catalogue-view";

export function PropertyView({ organization, property }: { organization: PublicOrganization; property: PublicProperty }) {
  const price = formatRupees(property.baseRateCents);
  const whatsapp = whatsappLink(organization.phone);
  const ask = whatsapp ? `${whatsapp}?text=${encodeURIComponent(`Hi, I'd like to ask about staying at ${property.name}.`)}` : null;
  const paragraphs = property.description.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);

  return (
    <main id="main" className="public-main">
      <div className="public-wrap property-top">
        <Link href={`/s/${organization.slug}`} className="property-back"><IconArrowLeft /> All places by {organization.name}</Link>
      </div>

      <section className="gallery public-wrap" aria-label="Photos">
        {property.photos.length === 0 ? (
          <div className="gallery-empty"><IconPhoto className="size-7" /><span>Photos coming soon</span></div>
        ) : (
          <div className="gallery-track">
            {property.photos.map((photo, index) => (
              <figure key={photo.id} className="gallery-item">
                {/* Signed Storage URLs with our own srcset: next/image would re-cache past URL expiry. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={photo.src}
                  srcSet={photo.srcSet || undefined}
                  sizes={index === 0 ? "(min-width: 1024px) 60vw, 92vw" : "(min-width: 1024px) 30vw, 92vw"}
                  alt={`${property.name}, photo ${index + 1} of ${property.photos.length}`}
                  loading={index === 0 ? "eager" : "lazy"}
                  fetchPriority={index === 0 ? undefined : "low"}
                  decoding="async"
                />
              </figure>
            ))}
          </div>
        )}
      </section>

      <div className="public-wrap property-layout">
        <article className="property-main">
          <header className="property-heading">
            <p className="public-eyebrow">{propertyTypeLabel(property.propertyType)}{organization.city ? ` · ${organization.city}` : ""}</p>
            <h1 className="public-display">{property.name}</h1>
            <p className="property-facts"><IconUser className="size-4" /> Up to {property.maxGuests} guests</p>
          </header>

          {paragraphs.length > 0 && (
            <section className="property-section" aria-labelledby="about-title">
              <h2 id="about-title" className="property-section-title">About this place</h2>
              <div className="property-description">{paragraphs.map((p) => <p key={p}>{p}</p>)}</div>
            </section>
          )}

          {property.amenities.length > 0 && (
            <section className="property-section" aria-labelledby="amenities-title">
              <h2 id="amenities-title" className="property-section-title">What this place offers</h2>
              <ul className="amenity-list" aria-label="Amenities">
                {property.amenities.map((a) => <li key={a}><IconCheck className="size-4" />{amenityLabel(a)}</li>)}
              </ul>
            </section>
          )}

          <div className="property-section"><HostCard organization={organization} /></div>
        </article>

        <aside className="booking-panel" aria-label="Price and contact">
          <p className="booking-price"><strong>{price}</strong> / night</p>
          <p className="booking-note">Dates, availability and booking requests are coming soon. For now, message the host to ask.</p>
          {ask && <a href={ask} className={buttonClasses("primary", "w-full")} rel="noopener"><IconChat className="size-4" /> Ask about dates on WhatsApp</a>}
        </aside>
      </div>

      {ask && (
        <div className="booking-bar" role="region" aria-label="Book this place">
          <p><strong>{price}</strong> / night</p>
          <a href={ask} className={buttonClasses("primary")} rel="noopener">Ask on WhatsApp</a>
        </div>
      )}
    </main>
  );
}
