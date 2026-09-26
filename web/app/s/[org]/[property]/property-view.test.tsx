import { render, screen, within } from "@testing-library/react";
import { expect, it } from "vitest";
import { PropertyView } from "./property-view";

const organization = { id: "o1", slug: "altit", name: "Altit Heights", headline: "", city: "Hunza", phone: "0300 1234567", hostingSince: 2026 };
const photo = (id: string) => ({ id, src: `https://img/${id}.webp`, srcSet: `https://img/${id}.w480.webp 480w` });
const property = {
  id: "p1", slug: "river-hut", name: "River Hut", propertyType: "cabin", baseRateCents: 1_500_000, maxGuests: 4,
  cover: photo("a"), photos: [photo("a"), photo("b"), photo("c")],
  description: "Wake up to Rakaposhi.\n\nA wood stove keeps the cabin warm.", amenities: ["wifi" as const, "hot_water" as const],
};

const stay = { availability: { minimumStay: 1, rules: [], blocks: [] }, today: "2026-10-01" };

// @req PUB-02
it("shows the gallery, nightly price, amenities and description", () => {
  render(<PropertyView organization={organization} property={property} {...stay} />);
  expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("River Hut");
  expect(within(screen.getByRole("region", { name: /photos/i })).getAllByRole("img")).toHaveLength(3);
  expect(screen.getAllByText("Rs 15,000").length).toBeGreaterThan(0);
  const amenities = screen.getByRole("list", { name: /amenities/i });
  expect(within(amenities).getByText("Wi-Fi")).toBeInTheDocument();
  expect(within(amenities).getByText("Hot water")).toBeInTheDocument();
  expect(screen.getByText("A wood stove keeps the cabin warm.")).toBeInTheDocument();
});

// @req PUB-03
it("shows the host profile and a way to ask about dates", () => {
  render(<PropertyView organization={organization} property={property} {...stay} />);
  expect(screen.getByRole("heading", { name: "Altit Heights" })).toBeInTheDocument();
  expect(screen.getAllByRole("link", { name: /whatsapp/i })[0]).toHaveAttribute("href", expect.stringContaining("https://wa.me/923001234567"));
});

it("a property with no photos, description or amenities still renders cleanly", () => {
  render(<PropertyView organization={organization} property={{ ...property, cover: null, photos: [], description: "", amenities: [] }} {...stay} />);
  expect(screen.getByText(/photos coming soon/i)).toBeInTheDocument();
  expect(screen.queryByRole("list", { name: /amenities/i })).not.toBeInTheDocument();
});

// @req CAL-07
it("has a section to pick dates and see the total", () => {
  render(<PropertyView organization={organization} property={property} {...stay} />);
  expect(screen.getByRole("heading", { name: "When you can stay" })).toBeInTheDocument();
  expect(screen.getByText("October 2026")).toBeInTheDocument();
  expect(screen.getByText(/pick your dates below to see the total/i)).toBeInTheDocument();
});
