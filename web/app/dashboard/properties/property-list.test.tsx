import { test, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { PropertyList } from "./property-list";

const base = { property_type: "villa", base_rate_cents: 1_500_000, max_guests: 4 };

// @req PROP-15
test("property list shows published or draft state and links published properties to their public page", () => {
  render(
    <PropertyList
      organizationSlug="sunset-stays"
      properties={[
        { ...base, id: "1", name: "Sea View", slug: "sea-view", published: true },
        { ...base, id: "2", name: "River Hut", slug: "river-hut", published: false },
      ]}
    />,
  );

  expect(screen.getByText("Published")).toBeInTheDocument();
  expect(screen.getByText("Draft")).toBeInTheDocument();

  const publicLinks = screen.getAllByRole("link", { name: /view public page/i });
  expect(publicLinks).toHaveLength(1);
  expect(publicLinks[0]).toHaveAttribute("href", "/s/sunset-stays/sea-view");

  expect(screen.getByRole("link", { name: "River Hut" })).toHaveAttribute("href", "/dashboard/properties/2");
  // Both fixtures share `base`, so this text renders twice (once per row) —
  // getAllByText, not getByText, or this throws on ambiguity.
  expect(screen.getAllByText("Rs 15,000 / night · up to 4 guests").length).toBeGreaterThan(0);
});

test("an empty property list explains what to do next", () => {
  render(<PropertyList organizationSlug="sunset-stays" properties={[]} />);
  expect(screen.getByText(/add your first property/i)).toBeInTheDocument();
});
