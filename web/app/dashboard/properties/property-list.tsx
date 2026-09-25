"use client";
import { useState } from "react";
import { buttonClasses } from "@/components/ui/button";
import Link from "next/link";
import { IconArrowUpRight, IconBuilding, IconPlus } from "@/components/ui/icons";
import { Sheet } from "@/components/ui/page-header";
import { Stamp } from "@/components/ui/stamp";
import { PROPERTY_TYPES, formatRupees, publicPropertyUrl, type PropertySummary } from "@/lib/properties/basics";

function typeLabel(value: string) {
  return PROPERTY_TYPES.find((type) => type.value === value)?.label ?? value;
}

export function PropertyList({
  organizationSlug,
  properties,
}: {
  organizationSlug: string;
  properties: PropertySummary[];
}) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const visible = properties.filter(p => p.name.toLowerCase().includes(query.toLowerCase()) && (status === "all" || (status === "published" ? p.published : !p.published)));
  if (properties.length === 0) {
    return (
      <div className="rounded-card border border-hairline bg-surface px-6 py-12 shadow-[var(--shadow-sheet)] sm:px-10 sm:py-14">
        <div className="flex max-w-md flex-col items-start gap-5">
          <span className="grid size-12 place-items-center rounded-2xl bg-accent-soft text-accent">
            <IconBuilding className="size-6" />
          </span>
          <div className="flex flex-col gap-2">
            <p className="text-lg font-medium text-ink">Your register is empty</p>
            <p className="leading-6 text-muted">
              Add your first property. You only need a name, an address and a nightly rate — photos and the details
              your AI assistant answers from can come after.
            </p>
          </div>
          <Link href="/dashboard/properties/new" className={buttonClasses("primary")}>
            <IconPlus className="size-4" />
            Add property
          </Link>
        </div>
      </div>
    );
  }

  return (
    <Sheet className="overflow-hidden property-directory">
      <div className="property-toolbar"><div><h2>Your properties</h2><p>{properties.length} places in your portfolio</p></div><div className="property-toolbar-controls"><input type="search" aria-label="Search properties" placeholder="Search properties..." value={query} onChange={e => setQuery(e.target.value)} /><select aria-label="Property status" value={status} onChange={e => setStatus(e.target.value)}><option value="all">All statuses</option><option value="published">Published only</option><option value="draft">Draft only</option></select></div></div>
      <div className="property-column-labels" aria-hidden="true"><span>Property</span><span>Status & public page</span></div>
      <ul className="divide-y divide-hairline">
        {visible.map((property, index) => (
          <li
            key={property.id}
            className="group relative flex flex-wrap items-center gap-x-5 gap-y-3 px-5 py-4 transition hover:bg-surface-muted/60 sm:flex-nowrap sm:px-6"
          >
            <span className="hidden w-7 shrink-0 font-mono text-xs tabular-nums text-muted sm:block">
              {String(index + 1).padStart(2, "0")}
            </span>
            <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-cloth/[0.07] text-cloth">
              <IconBuilding className="size-5" />
            </span>
            <div className="flex min-w-0 flex-1 flex-col">
              <a
                href={`/dashboard/properties/${property.id}`}
                className="inline-flex min-h-8 items-center truncate text-[15px] font-medium text-ink after:absolute after:inset-0 hover:text-accent"
              >
                {property.name}
              </a>
              <span className="flex flex-col text-sm text-muted sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-2">
                <span>{typeLabel(property.property_type)}</span>
                <span aria-hidden="true" className="hidden sm:inline">·</span>
                <span className="tabular-nums">
                  {formatRupees(property.base_rate_cents)} / night · up to {property.max_guests} guests
                </span>
              </span>
            </div>
            <div className="relative z-10 flex w-full items-center justify-between gap-4 ps-[4.25rem] sm:w-auto sm:justify-end sm:ps-0">
              {property.published ? (
                <Stamp tone="green" tilt={-3}>
                  Published
                </Stamp>
              ) : (
                <Stamp tone="grey" tilt={2}>
                  Draft
                </Stamp>
              )}
              {property.published ? (
                <a
                  href={publicPropertyUrl(organizationSlug, property.slug)}
                  className="inline-flex min-h-11 items-center gap-1 whitespace-nowrap rounded-lg px-2 text-sm font-medium text-accent hover:bg-accent-soft"
                >
                  View public page
                  <IconArrowUpRight />
                </a>
              ) : (
                <span className="hidden min-h-11 w-[9.5rem] sm:block" aria-hidden="true" />
              )}
            </div>
          </li>
        ))}
      </ul>
      {visible.length === 0 && <div className="panel-empty"><h3>No matching properties</h3><p>Try another name or change the status filter.</p><button type="button" className="text-sm text-accent" onClick={() => { setQuery(""); setStatus("all"); }}>Clear filters</button></div>}
      <div className="property-list-footer">Showing {visible.length} of {properties.length} properties</div>
    </Sheet>
  );
}
