import type { PublicOrganization } from "@/lib/public/catalogue";
import { telLink, whatsappLink } from "@/lib/public/catalogue";
import { buttonClasses } from "@/components/ui/button";
import { IconChat } from "@/components/ui/icons";

export function HostCard({ organization }: { organization: PublicOrganization }) {
  const whatsapp = whatsappLink(organization.phone);
  const tel = telLink(organization.phone);
  return (
    <section className="host-card" aria-labelledby="host-card-title">
      <span className="host-avatar" aria-hidden="true">{organization.name.trim().charAt(0).toUpperCase()}</span>
      <div className="host-body">
        <p className="public-eyebrow">Your host</p>
        <h2 id="host-card-title" className="host-name">{organization.name}</h2>
        {/* One text node, not sibling spans: the hero above already renders
            the bare city name as its eyebrow, and two elements whose own
            text is exactly the city name confuses text-content lookups. */}
        <p className="host-meta">{[organization.city, `Hosting since ${organization.hostingSince}`].filter(Boolean).join(" · ")}</p>
      </div>
      {(whatsapp || tel) && (
        <div className="host-actions">
          {whatsapp && (
            <a href={whatsapp} className={buttonClasses("primary")} rel="noopener">
              <IconChat className="size-4" /> Message on WhatsApp
            </a>
          )}
          {tel && <a href={tel} className={buttonClasses("secondary")}>Call {organization.phone}</a>}
        </div>
      )}
    </section>
  );
}
