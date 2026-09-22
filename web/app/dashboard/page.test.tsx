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
