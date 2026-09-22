import { test, expect } from "vitest";
import { resolveDashboardAccess } from "./dashboard-access";

// @req AUTH-07
test("an unauthenticated visitor is sent to login", () => {
  expect(resolveDashboardAccess({ user: null, organization: null })).toBe("login");
});

// @req AUTH-08
test("a host without an organisation is sent to onboarding", () => {
  expect(resolveDashboardAccess({ user: { id: "u1" }, organization: null })).toBe("onboarding");
});

// @req AUTH-12
test("a host with an organisation is allowed onto the dashboard", () => {
  expect(
    resolveDashboardAccess({ user: { id: "u1" }, organization: { id: "org1" } }),
  ).toBe("allow");
});
