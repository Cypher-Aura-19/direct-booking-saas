import { test, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { GuestBookingCard } from "./guest-booking-card";
import type { GuestBookingView } from "@/lib/bookings/guest";

const base: GuestBookingView = {
  status: "requested", startDate: "2026-11-01", endDate: "2026-11-04", nights: 3, totalCents: 1_500_000,
  advancePercent: 30, advanceCents: 450_000, paymentInstructions: null, idUpload: null,
};

test("a pending request tells the guest it is waiting on the host and shows no payment details", () => {
  render(<GuestBookingCard view={base} />);
  expect(screen.getByText(/waiting for the host/i)).toBeInTheDocument();
  expect(screen.queryByText(/easypaisa/i)).not.toBeInTheDocument();
});

// @req BOOK-12
test("an approved booking shows the amount to pay and the host's payment instructions", () => {
  render(<GuestBookingCard view={{ ...base, status: "approved", paymentInstructions: { bankName: "HBL", accountTitle: "Hunza Stays", accountNumber: "1234 5678", easypaisa: "03001234567", jazzcash: "", note: "Send the receipt here." } }} />);
  expect(screen.getByText(/approved by the host/i)).toBeInTheDocument();
  expect(screen.getByText(/30%/)).toBeInTheDocument();
  expect(screen.getByText("1234 5678")).toBeInTheDocument();
  expect(screen.getByText("03001234567")).toBeInTheDocument();
  expect(screen.getByText("Send the receipt here.")).toBeInTheDocument();
  expect(screen.queryByText(/jazzcash/i)).not.toBeInTheDocument(); // empty methods are omitted
});

test("a declined request says so plainly", () => {
  render(<GuestBookingCard view={{ ...base, status: "rejected" }} />);
  expect(screen.getByText(/wasn.t accepted/i)).toBeInTheDocument();
});

const paidView: GuestBookingView = { ...base, status: "paid" };

// @req CNIC-01
test("a paid booking with an open upload link prompts the guest to upload their ID", () => {
  render(<GuestBookingCard view={{ ...paidView, idUpload: { status: "open", path: `/id/${"b".repeat(64)}` } }} />);
  const link = screen.getByRole("link", { name: /upload your id/i });
  expect(link).toHaveAttribute("href", `/id/${"b".repeat(64)}`);
});

test("once the ID is received the prompt becomes a thank-you, and an expired link shows nothing", () => {
  const { rerender } = render(<GuestBookingCard view={{ ...paidView, idUpload: { status: "received" } }} />);
  expect(screen.getByText(/ID received/i)).toBeInTheDocument();
  expect(screen.queryByRole("link", { name: /upload your id/i })).not.toBeInTheDocument();
  rerender(<GuestBookingCard view={{ ...paidView, idUpload: null }} />);
  expect(screen.queryByText(/ID received/i)).not.toBeInTheDocument();
});
