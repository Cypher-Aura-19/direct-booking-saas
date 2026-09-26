import { render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { MonthGrid } from "./month-grid";

it("lays out a month Monday-first with the right day count and states", () => {
  const onSelect = vi.fn();
  render(
    <MonthGrid
      month="2026-10-15"
      stateFor={(d) => (d === "2026-10-10" ? "blocked" : d < "2026-10-05" ? "past" : "available")}
      onSelect={onSelect}
      labelFor={(d, s) => `${d} ${s}`}
    />,
  );
  expect(screen.getByText("October 2026")).toBeInTheDocument();
  expect(screen.getAllByRole("gridcell")).toHaveLength(31);
  // October 2026 starts on a Thursday: 3 pad cells + 31 days = 5 week rows.
  const rows = screen.getAllByRole("row");
  expect(rows).toHaveLength(5);
  for (const row of rows) expect(row.parentElement).toHaveAttribute("role", "grid");
  expect(screen.getByRole("button", { name: "2026-10-06 available" })).toBeEnabled();
  expect(screen.queryByRole("button", { name: "2026-10-10 blocked" })).toBeNull();
  screen.getByRole("button", { name: "2026-10-06 available" }).click();
  expect(onSelect).toHaveBeenCalledWith("2026-10-06");
});
