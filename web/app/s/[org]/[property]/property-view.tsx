import Link from "next/link";
import { HostCard } from "@/components/public/host-card";
import { buttonClasses } from "@/components/ui/button";
import { IconArrowLeft, IconCheck, IconChat, IconPhoto, IconUser } from "@/components/ui/icons";
import { formatRupees } from "@/lib/properties/basics";
import { amenityLabel } from "@/lib/properties/listing";
import { whatsappLink, type PublicAvailability, type PublicOrganization, type PublicProperty } from "@/lib/public/catalogue";
import { propertyTypeLabel } from "../catalogue-view";
import { ChatPanel } from "./chat/chat-panel";
import { StayPicker } from "./stay-picker";

type Props = { organization: PublicOrganization; property: PublicProperty; availability: PublicAvailability; today: string };

export function PropertyView({ organization, property, availability, today }: Props) {
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

          <section className="property-section" aria-labelledby="availability-title">
            <h2 id="availability-title" className="property-section-title">When you can stay</h2>
            <StayPicker baseRateCents={property.baseRateCents} availability={availability} today={today} whatsappHref={whatsapp} propertyName={property.name} />
          </section>

          <div id="chat" className="property-section chat-section">
            <h2 className="property-section-title">Ask a question</h2>
            <ChatPanel propertyId={property.id} propertyName={property.name} hostName={organization.name} />
          </div>

          <div className="property-section"><HostCard organization={organization} /></div>
        </article>

        <aside className="booking-panel" aria-label="Price and contact">
          <p className="booking-price"><strong>{price}</strong> / night</p>
          <p className="booking-note">Pick your dates below to see the total, then message the host to book.</p>
          <a href="#chat" className={buttonClasses("primary", "w-full")}><IconChat className="size-4" /> Ask a question</a>
          {ask && <a href={ask} className={buttonClasses("secondary", "w-full")} rel="noopener">Message on WhatsApp</a>}
        </aside>
      </div>

      <div className="booking-bar" role="region" aria-label="Book this place">
        <p className="booking-bar-price"><strong>{price}</strong> <span>/ night</span></p>
        <div className="booking-bar-actions">
          {ask && <a href={ask} className={buttonClasses("ghost", "booking-bar-whatsapp")} rel="noopener">WhatsApp</a>}
          <a href="#chat" className={buttonClasses("primary", "booking-bar-ask")}>Ask a question</a>
        </div>
      </div>
    </main>
  );
}
