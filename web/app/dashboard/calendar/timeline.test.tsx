import { expect, test } from "vitest";
import { render, screen } from "@testing-library/react";
import { Timeline } from "./timeline";
import type { CalendarRow } from "@/lib/availability/calendar";

const rows: CalendarRow[] = [
  {
    propertyId: "p1",
    propertyName: "River Hut",
    entries: [{ start: "2026-10-12", end: "2026-10-15", kind: "booking", label: "Booked" }],
  },
  { propertyId: "p2", propertyName: "Valley View", entries: [] },
];

// @req CAL-03
test("renders every property row and a labeled booking bar", () => {
  render(<Timeline from="2026-10-01" nights={30} rows={rows} />);
  expect(screen.getByText("River Hut")).toBeInTheDocument();
  expect(screen.getByText("Valley View")).toBeInTheDocument();
  expect(screen.getByRole("group", { name: "River Hut: Booked 12 Oct – 14 Oct" })).toBeInTheDocument();
});

// @req CAL-03
test("shows the empty state with no properties", () => {
  render(<Timeline from="2026-10-01" nights={30} rows={[]} />);
  expect(screen.getByText("Add a property to see its calendar here.")).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "Add a property" })).toHaveAttribute("href", "/dashboard/properties/new");
});
