import { test, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { InboxBookingCard } from "./booking-card";
import type { HostBooking } from "@/lib/bookings/host";

const booking: HostBooking = {
  id: "b1", propertyId: "p1", propertyName: "River Hut", conversationId: "c1", guestName: "Ayesha", guestPhone: "03001234567",
  startDate: "2026-11-01", endDate: "2026-11-04", nights: 3, status: "requested", totalCents: 1_500_000, createdAt: "2026-10-01T10:00:00Z",
};

test("a pending booking is pinned with its status and a link to review it", () => {
  render(<InboxBookingCard booking={booking} />);
  expect(screen.getByText("Requested")).toBeInTheDocument();
  expect(screen.getByRole("link", { name: /review request/i })).toHaveAttribute("href", "/dashboard/bookings/b1");
});

test("a decided booking links to the booking, not 'review request'", () => {
  render(<InboxBookingCard booking={{ ...booking, status: "approved" }} />);
  expect(screen.getByRole("link", { name: /view booking/i })).toHaveAttribute("href", "/dashboard/bookings/b1");
});
