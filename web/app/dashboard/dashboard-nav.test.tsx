// web/app/dashboard/dashboard-nav.test.tsx
import { test, expect, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { DashboardNav, WorkspaceHeader } from "./dashboard-nav";

let mockPathname = "/dashboard";
vi.mock("next/navigation", () => ({ usePathname: () => mockPathname }));

test("the Inbox nav item is a real link, not a disabled 'Soon' placeholder", () => {
  render(<DashboardNav />);
  // Both the sidebar nav and the mobile tab bar render Inbox links in jsdom
  // (there's no real CSS here to enforce the `hidden`/`md:hidden` Tailwind
  // classes that would keep only one visible in a browser), so scope to the
  // sidebar to avoid an ambiguous match.
  const sidebar = screen.getByTestId("dashboard-sidebar");
  const link = within(sidebar).getByRole("link", { name: /inbox/i });
  expect(link).toHaveAttribute("href", "/dashboard/inbox");
  expect(screen.queryByText(/soon/i)).not.toBeInTheDocument();

  // The mobile tab bar renders its own Inbox link independently of the
  // sidebar's; scope to it separately so this test also catches a regression
  // there (e.g. Inbox missing from, or misconfigured in, the tab bar's item
  // list) rather than only ever checking the sidebar.
  const tabbar = screen.getByTestId("dashboard-tabbar");
  const tabbarLink = within(tabbar).getByRole("link", { name: /inbox/i });
  expect(tabbarLink).toHaveAttribute("href", "/dashboard/inbox");
});

test("the workspace breadcrumb names the Inbox section on /dashboard/inbox routes", () => {
  mockPathname = "/dashboard/inbox/c1";
  render(<WorkspaceHeader organizationName="Test Org" />);
  expect(screen.getByText("Inbox")).toBeInTheDocument();
  mockPathname = "/dashboard"; // reset so later tests in this file aren't affected
});
