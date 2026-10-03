import { test, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { CopyField } from "./copy-field";

const writeText = vi.fn();
beforeEach(() => {
  writeText.mockReset();
  writeText.mockResolvedValue(undefined);
  Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
});

// @req CNIC-08
test("each field shows its value with a copy button that copies exactly that value", async () => {
  render(<dl><CopyField label="CNIC number" value="35202-1234567-1" /></dl>);
  expect(screen.getByText("35202-1234567-1")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: /copy cnic number/i }));
  await waitFor(() => expect(writeText).toHaveBeenCalledWith("35202-1234567-1"));
  expect(await screen.findByText(/copied/i)).toBeInTheDocument();
});

test("a blocked clipboard does not throw or claim success", async () => {
  writeText.mockRejectedValue(new Error("denied"));
  render(<dl><CopyField label="Phone" value="0300" /></dl>);
  fireEvent.click(screen.getByRole("button", { name: /copy phone/i }));
  await waitFor(() => expect(writeText).toHaveBeenCalled());
  expect(screen.queryByText(/copied/i)).not.toBeInTheDocument();
});
