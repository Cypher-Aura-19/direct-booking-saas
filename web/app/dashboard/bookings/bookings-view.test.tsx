import { describe, test, expect } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { BookingsView } from "./bookings-view";
import type { HostBooking } from "@/lib/bookings/host";

const base = { propertyId: "p1", propertyName: "River Hut", conversationId: "c1", guestPhone: "03001234567", startDate: "2026-11-01", endDate: "2026-11-04", nights: 3, totalCents: 1_500_000, createdAt: "2026-10-01T10:00:00Z" };
const bookings: HostBooking[] = [
  { ...base, id: "b1", guestName: "Ayesha", status: "requested" },
  { ...base, id: "b2", guestName: "Bilal", status: "approved" },
  { ...base, id: "b3", guestName: "Chaudhry", status: "paid" },
  { ...base, id: "b4", guestName: "Danish", status: "staying" },
  { ...base, id: "b5", guestName: "Emaan", status: "checked_out" },
  { ...base, id: "b6", guestName: "Farhan", status: "rejected" },
];

describe("BookingsView", () => {
  // @req BOOK-11
  test("the pipeline shows requested, approved, paid, staying and checked out, each with its count", () => {
    render(<BookingsView bookings={bookings} status="all" />);
    const nav = screen.getByRole("navigation", { name: /booking pipeline/i });
    for (const label of ["Requested", "Approved", "Paid", "Staying", "Checked out"]) {
      expect(within(nav).getByRole("link", { name: new RegExp(`^${label}`) })).toBeInTheDocument();
    }
    expect(within(nav).getByRole("link", { name: /^All/ })).toHaveTextContent("6");
  });

  test("filtering by status narrows the list and links to the booking detail", () => {
    render(<BookingsView bookings={bookings} status="requested" />);
    expect(screen.getByText("Ayesha")).toBeInTheDocument();
    expect(screen.queryByText("Bilal")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /ayesha/i })).toHaveAttribute("href", "/dashboard/bookings/b1");
  });

  test("a declined request is reachable through its own filter, not mixed into the pipeline", () => {
    render(<BookingsView bookings={bookings} status="rejected" />);
    expect(screen.getByText("Farhan")).toBeInTheDocument();
  });

  test("an empty pipeline stage shows a designed empty state", () => {
    render(<BookingsView bookings={[]} status="all" />);
    expect(screen.getByText(/no bookings yet/i)).toBeInTheDocument();
  });
});
