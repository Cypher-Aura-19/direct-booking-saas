import { test, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import DashboardError from "./error";

test("the dashboard error boundary shows a calm message and retries via reset(), never the raw error", () => {
  const reset = vi.fn();
  render(<DashboardError error={new Error("relation properties does not exist")} reset={reset} />);

  expect(screen.getByText("Something went wrong loading this page.")).toBeInTheDocument();
  expect(screen.queryByText(/relation properties does not exist/i)).not.toBeInTheDocument();

  fireEvent.click(screen.getByRole("button", { name: /try again/i }));
  expect(reset).toHaveBeenCalledOnce();
});
