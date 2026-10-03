import { describe, test, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { BookingActions } from "./booking-actions";
import * as actions from "../actions";

vi.mock("../actions", () => ({
  approveBookingAction: vi.fn(),
  rejectBookingAction: vi.fn(),
  markPaidAction: vi.fn(),
  checkInAction: vi.fn(),
  checkOutAction: vi.fn(),
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
const approve = vi.mocked(actions.approveBookingAction);
const reject = vi.mocked(actions.rejectBookingAction);
const paid = vi.mocked(actions.markPaidAction);
const checkIn = vi.mocked(actions.checkInAction);
const checkOut = vi.mocked(actions.checkOutAction);

describe("BookingActions", () => {
  beforeEach(() => { for (const fn of [approve, reject, paid, checkIn, checkOut]) fn.mockReset(); });

  // @req BOOK-05
  test("a requested booking offers approve and reject; approving confirms first, then calls the action", async () => {
    approve.mockResolvedValue({ error: null });
    render(<BookingActions bookingId="b1" status="requested" />);
    expect(screen.getByRole("button", { name: /^reject$/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /^approve$/i }));
    expect(screen.getByText(/lock these dates/i)).toBeInTheDocument();
    expect(approve).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: /confirm approval/i }));
    await waitFor(() => expect(approve).toHaveBeenCalledWith("b1"));
  });

  // @req BOOK-05
  test("rejecting also confirms first", async () => {
    reject.mockResolvedValue({ error: null });
    render(<BookingActions bookingId="b1" status="requested" />);
    fireEvent.click(screen.getByRole("button", { name: /^reject$/i }));
    fireEvent.click(screen.getByRole("button", { name: /confirm rejection/i }));
    await waitFor(() => expect(reject).toHaveBeenCalledWith("b1"));
  });

  test("cancelling the confirmation does nothing", () => {
    render(<BookingActions bookingId="b1" status="requested" />);
    fireEvent.click(screen.getByRole("button", { name: /^approve$/i }));
    fireEvent.click(screen.getByRole("button", { name: /cancel/i }));
    expect(approve).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: /^approve$/i })).toBeInTheDocument();
  });

  test("a server error is shown and the buttons come back", async () => {
    approve.mockResolvedValue({ error: "Those dates were just taken by another booking." });
    render(<BookingActions bookingId="b1" status="requested" />);
    fireEvent.click(screen.getByRole("button", { name: /^approve$/i }));
    fireEvent.click(screen.getByRole("button", { name: /confirm approval/i }));
    expect(await screen.findByText(/just taken/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^approve$/i })).toBeEnabled();
  });

  // @req PAY-01
  test("an approved booking offers 'Mark payment received', and says the AI resumes", async () => {
    paid.mockResolvedValue({ error: null });
    render(<BookingActions bookingId="b1" status="approved" />);
    expect(screen.queryByRole("button", { name: /^approve$/i })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /mark payment received/i }));
    expect(screen.getByText(/AI resumes/i)).toBeInTheDocument();
    expect(paid).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: /confirm payment received/i }));
    await waitFor(() => expect(paid).toHaveBeenCalledWith("b1"));
  });

  // @req PAY-06
  test("a paid booking offers check-in; a staying booking offers check-out", async () => {
    checkIn.mockResolvedValue({ error: null });
    const first = render(<BookingActions bookingId="b1" status="paid" />);
    fireEvent.click(screen.getByRole("button", { name: /^check in$/i }));
    fireEvent.click(screen.getByRole("button", { name: /confirm check-in/i }));
    await waitFor(() => expect(checkIn).toHaveBeenCalledWith("b1"));
    first.unmount();

    checkOut.mockResolvedValue({ error: null });
    render(<BookingActions bookingId="b1" status="staying" />);
    expect(screen.queryByRole("button", { name: /^check in$/i })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /^check out$/i }));
    fireEvent.click(screen.getByRole("button", { name: /confirm check-out/i }));
    await waitFor(() => expect(checkOut).toHaveBeenCalledWith("b1"));
  });

  // @req PAY-06
  test("a finished or declined booking offers nothing", () => {
    for (const status of ["checked_out", "rejected"] as const) {
      const { container, unmount } = render(<BookingActions bookingId="b1" status={status} />);
      expect(container).toBeEmptyDOMElement();
      unmount();
    }
  });
});
