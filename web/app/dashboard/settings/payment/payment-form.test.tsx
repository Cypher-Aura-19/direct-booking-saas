import { test, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { PaymentForm } from "./payment-form";
import * as actions from "./actions";

vi.mock("./actions", () => ({ updatePaymentInstructionsAction: vi.fn().mockResolvedValue({ error: null, success: true }) }));

const empty = { bankName: "", accountTitle: "", accountNumber: "", easypaisa: "", jazzcash: "", note: "" };

// @req BOOK-12
test("a host edits the payment instructions guests will see once a booking is approved", async () => {
  render(<PaymentForm instructions={{ ...empty, easypaisa: "03001234567" }} />);
  expect(screen.getByLabelText(/easypaisa/i)).toHaveValue("03001234567");
  fireEvent.change(screen.getByLabelText(/account number/i), { target: { value: "1234 5678" } });
  fireEvent.click(screen.getByRole("button", { name: /save/i }));
  await waitFor(() => expect(actions.updatePaymentInstructionsAction).toHaveBeenCalled());
  const formData = vi.mocked(actions.updatePaymentInstructionsAction).mock.calls[0][1] as FormData;
  expect(formData.get("accountNumber")).toBe("1234 5678");
  expect(formData.get("easypaisa")).toBe("03001234567");
});

test("explains who sees this and when", () => {
  render(<PaymentForm instructions={empty} />);
  expect(screen.getByText(/only after you approve/i)).toBeInTheDocument();
});
