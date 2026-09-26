import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import { StayPicker } from "./stay-picker";

const availability = {
  minimumStay: 2,
  blocks: [{ start: "2026-10-10", end: "2026-10-12" }],
  rules: [{ start: "2026-10-20", end: "2026-10-22", rateCents: 2_500_000, minimumStay: 1 }],
};

function renderPicker() {
  render(
    <StayPicker
      baseRateCents={1_000_000}
      availability={availability}
      today="2026-10-01"
      whatsappHref="https://wa.me/923001234567"
      propertyName="River Hut"
    />,
  );
}

const day = (label: RegExp) => screen.getByRole("button", { name: label });

// @req CAL-07
it("shows this month and the next, starting from today's month", () => {
  renderPicker();
  expect(screen.getByText("October 2026")).toBeInTheDocument();
  expect(screen.getByText("November 2026")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /previous month/i })).toBeDisabled();
  fireEvent.click(screen.getByRole("button", { name: /next month/i }));
  expect(screen.getByText("December 2026")).toBeInTheDocument();
  expect(screen.queryByText("October 2026")).toBeNull();
  expect(screen.getByText("Select your check-in date.")).toBeInTheDocument();
  expect(screen.getByText("Minimum stay: 2 nights")).toBeInTheDocument();
});

// @req CAL-08
it("blocked nights are shown as unavailable and can't be picked", () => {
  renderPicker();
  for (const label of [/^Saturday 10 October 2026/, /^Sunday 11 October 2026/]) {
    expect(screen.queryByRole("button", { name: label })).toBeNull();
    expect(screen.getByLabelText(label).getAttribute("aria-label")).toMatch(/, unavailable$/);
  }
  expect(screen.getByLabelText(/^Monday 12 October 2026/).getAttribute("aria-label")).toBe("Monday 12 October 2026, available");
});

// @req CAL-09
it("prices the chosen nights, seasonal rates included, and links to WhatsApp", () => {
  renderPicker();
  fireEvent.click(day(/^Monday 19 October 2026/));
  expect(day(/^Monday 19 October 2026/)).toHaveAccessibleName("Monday 19 October 2026, check-in");
  fireEvent.click(day(/^Thursday 22 October 2026/));
  expect(screen.getByText("3 nights")).toBeInTheDocument();
  expect(screen.getByText("Rs 60,000")).toBeInTheDocument();
  expect(screen.getByText("1 × Rs 10,000 · 2 × Rs 25,000")).toBeInTheDocument();
  expect(day(/^Thursday 22 October 2026/)).toHaveAccessibleName("Thursday 22 October 2026, checkout");
  const link = screen.getByRole("link", { name: /ask to book on whatsapp/i });
  expect(link.getAttribute("href")).toBe(
    `https://wa.me/923001234567?text=${encodeURIComponent("Hi, I'd like to book River Hut from 19 Oct to 22 Oct (3 nights).")}`,
  );
  fireEvent.click(screen.getByRole("button", { name: /clear dates/i }));
  expect(screen.getByText("Select your check-in date.")).toBeInTheDocument();
});

// @req CAL-08
it("checkout can land on a blocked morning but never cross it, and the minimum stay applies", () => {
  renderPicker();
  fireEvent.click(day(/^Friday 9 October 2026/));
  expect(screen.queryByRole("button", { name: /^Tuesday 13 October 2026/ })).toBeNull();
  fireEvent.click(day(/^Saturday 10 October 2026/));
  expect(screen.getByText("This stay needs at least 2 nights.")).toBeInTheDocument();
  expect(screen.queryByRole("link", { name: /ask to book/i })).toBeNull();
});

it("a tap before check-in starts again from that night", () => {
  renderPicker();
  fireEvent.click(day(/^Thursday 15 October 2026/));
  fireEvent.click(day(/^Tuesday 13 October 2026/));
  expect(day(/^Tuesday 13 October 2026/)).toHaveAccessibleName("Tuesday 13 October 2026, check-in");
  expect(screen.getByText("Select your checkout date.")).toBeInTheDocument();
});
