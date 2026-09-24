import { test, expect } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { DashboardNav } from "./layout";

// @req AUTH-14
test("dashboard nav renders both a desktop sidebar and a mobile bottom tab bar", () => {
  render(<DashboardNav />);

  const sidebar = screen.getByTestId("dashboard-sidebar");
  const tabBar = screen.getByTestId("dashboard-tabbar");

  expect(sidebar.className).toMatch(/hidden/);
  expect(sidebar.className).toMatch(/md:flex/);
  expect(tabBar.className).toMatch(/md:hidden/);

  for (const label of ["Home", "Inbox", "Calendar", "Properties", "Settings"]) {
    expect(within(sidebar).getByText(label)).toBeInTheDocument();
  }
  for (const label of ["Home", "Inbox", "Calendar", "More"]) {
    expect(within(tabBar).getByText(label)).toBeInTheDocument();
  }
  expect(within(tabBar).getByText("More").closest("a")).toHaveAttribute("href", "/dashboard/settings");
});
