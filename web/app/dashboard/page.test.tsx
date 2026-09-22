import { test, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { DashboardHome } from "./page";

// @req AUTH-13
test("the dashboard home lists the four sections it promises, empty by default", () => {
  render(
    <DashboardHome
      pendingBookings={[]}
      escalatedConversations={[]}
      unreadMessages={[]}
      todaysArrivalsAndDepartures={[]}
    />,
  );
  expect(screen.getByText(/nothing needs you right now/i)).toBeInTheDocument();
});

// @req AUTH-13
test("the dashboard home lists each non-empty section by name", () => {
  render(
    <DashboardHome
      pendingBookings={[{ id: "b1" }]}
      escalatedConversations={[{ id: "c1" }]}
      unreadMessages={[{ id: "m1" }]}
      todaysArrivalsAndDepartures={[{ id: "a1" }]}
    />,
  );
  expect(screen.getByText(/waiting booking requests/i)).toBeInTheDocument();
  expect(screen.getByText(/escalated chats/i)).toBeInTheDocument();
  expect(screen.getByText(/unread messages/i)).toBeInTheDocument();
  expect(screen.getByText(/today's arrivals and departures/i)).toBeInTheDocument();
});
