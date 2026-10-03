import { describe, test, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { RequestForm } from "./request-form";
import * as actions from "./request-actions";

vi.mock("./request-actions", () => ({ requestBookingAction: vi.fn() }));
const action = vi.mocked(actions.requestBookingAction);

function fill(name: string, phone: string) {
  fireEvent.change(screen.getByLabelText(/your name/i), { target: { value: name } });
  fireEvent.change(screen.getByLabelText(/phone/i), { target: { value: phone } });
}

describe("RequestForm", () => {
  beforeEach(() => { action.mockReset(); localStorage.clear(); });

  // @req BOOK-01
  test("submits the dates and contact details and shows the confirmation with a link to the chat", async () => {
    action.mockResolvedValue({ ok: true, token: "a".repeat(64), nights: 3, totalCents: 1_500_000 });
    render(<RequestForm propertyId="p1" checkIn="2026-11-01" checkOut="2026-11-04" />);
    fill("Ayesha Khan", "0300 1234567");
    fireEvent.click(screen.getByRole("button", { name: /request to book/i }));
    await waitFor(() => expect(action).toHaveBeenCalledWith({ propertyId: "p1", token: null, checkIn: "2026-11-01", checkOut: "2026-11-04", name: "Ayesha Khan", phone: "0300 1234567" }));
    expect(await screen.findByText(/request sent/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /open your chat/i })).toHaveAttribute("href", `/c/${"a".repeat(64)}`);
    expect(localStorage.getItem("qayam-chat:p1")).toBe("a".repeat(64)); // the chat panel adopts it
  });

  test("reuses the chat token this browser already holds", async () => {
    localStorage.setItem("qayam-chat:p1", "b".repeat(64));
    action.mockResolvedValue({ ok: true, token: "b".repeat(64), nights: 1, totalCents: 500_000 });
    render(<RequestForm propertyId="p1" checkIn="2026-11-01" checkOut="2026-11-02" />);
    fill("Ayesha Khan", "03001234567");
    fireEvent.click(screen.getByRole("button", { name: /request to book/i }));
    await waitFor(() => expect(action).toHaveBeenCalledWith(expect.objectContaining({ token: "b".repeat(64) })));
  });

  test("shows the server's reason and keeps what the guest typed", async () => {
    action.mockResolvedValue({ ok: false, message: "Those dates aren't available. Try others." });
    render(<RequestForm propertyId="p1" checkIn="2026-11-01" checkOut="2026-11-04" />);
    fill("Ayesha Khan", "03001234567");
    fireEvent.click(screen.getByRole("button", { name: /request to book/i }));
    expect(await screen.findByText(/aren't available/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/your name/i)).toHaveValue("Ayesha Khan");
    expect(screen.queryByText(/request sent/i)).not.toBeInTheDocument();
  });

  test("a thrown action never leaves the button stuck", async () => {
    action.mockRejectedValue(new Error("network"));
    render(<RequestForm propertyId="p1" checkIn="2026-11-01" checkOut="2026-11-04" />);
    fill("Ayesha Khan", "03001234567");
    fireEvent.click(screen.getByRole("button", { name: /request to book/i }));
    expect(await screen.findByText(/something went wrong/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /request to book/i })).toBeEnabled();
  });
});
