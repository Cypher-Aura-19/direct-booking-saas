import { render, screen, within } from "@testing-library/react";
import { expect, it } from "vitest";
import { PRODUCT_NAME } from "@/lib/brand";
import { CatalogueView } from "./catalogue-view";
import PublicLayout from "./layout";

const organization = {
  id: "o1", slug: "altit", name: "Altit Heights", headline: "Four cabins above the river",
  city: "Hunza", phone: "0300 1234567", hostingSince: 2026,
};
const property = {
  id: "p1", slug: "river-hut", name: "River Hut", propertyType: "cabin", baseRateCents: 1_500_000, maxGuests: 4,
  cover: { id: "ph1", src: "https://img/960.webp", srcSet: "https://img/480.webp 480w, https://img/960.webp 960w" },
};

// @req PUB-01
it("lists each published property with its price and a link to its page", () => {
  render(<CatalogueView organization={organization} properties={[property]} />);
  const link = screen.getByRole("link", { name: /river hut/i });
  expect(link).toHaveAttribute("href", "/s/altit/river-hut");
  expect(within(link).getByText("Rs 15,000")).toBeInTheDocument();
  expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Altit Heights");
});

// @req PUB-03
it("shows the host's profile with a way to contact them", () => {
  render(<CatalogueView organization={organization} properties={[property]} />);
  expect(screen.getByText("Hunza")).toBeInTheDocument();
  expect(screen.getByRole("link", { name: /whatsapp/i })).toHaveAttribute("href", "https://wa.me/923001234567");
});

// @req PUB-10
it("an organisation with nothing published gets a written empty state", () => {
  render(<CatalogueView organization={organization} properties={[]} />);
  expect(screen.getByText(/no places are open for booking yet/i)).toBeInTheDocument();
  expect(screen.getByRole("link", { name: /whatsapp/i })).toBeInTheDocument();
});

it("the public footer names the product as plain text, not the Urdu-seal wordmark", () => {
  render(<PublicLayout>{null}</PublicLayout>);
  expect(screen.getByText(PRODUCT_NAME)).toBeInTheDocument();
});
