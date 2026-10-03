"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/notice";
import type { BookingStatus } from "@/lib/bookings/host";
import { approveBookingAction, checkInAction, checkOutAction, markPaidAction, rejectBookingAction } from "../actions";

type ActionKey = "approve" | "reject" | "paid" | "checkin" | "checkout";
type Result = { error: string | null };

// Every step confirms first, and the confirmation says what will happen.
const ACTIONS: Record<ActionKey, { label: string; confirmLabel: string; text: string; run: (id: string) => Promise<Result> }> = {
  approve: {
    label: "Approve",
    confirmLabel: "Confirm approval",
    text: "Approve and lock these dates? The AI will go quiet in this chat and the guest will see your payment details.",
    run: approveBookingAction,
  },
  reject: {
    label: "Reject",
    confirmLabel: "Confirm rejection",
    text: "Reject this request? The guest is told it wasn't accepted and the calendar stays as it is.",
    run: rejectBookingAction,
  },
  paid: {
    label: "Mark payment received",
    confirmLabel: "Confirm payment received",
    text: "Mark payment received? The AI resumes in this chat and the guest is told they're confirmed.",
    run: markPaidAction,
  },
  checkin: {
    label: "Check in",
    confirmLabel: "Confirm check-in",
    text: "Mark this guest as checked in?",
    run: checkInAction,
  },
  checkout: {
    label: "Check out",
    confirmLabel: "Confirm check-out",
    text: "Mark this guest as checked out? This completes the stay.",
    run: checkOutAction,
  },
};

// The next step(s) at each stage of the pipeline; the first is the primary action.
const AVAILABLE: Partial<Record<BookingStatus, ActionKey[]>> = {
  requested: ["approve", "reject"],
  approved: ["paid"],
  paid: ["checkin"],
  staying: ["checkout"],
};

export function BookingActions({ bookingId, status }: { bookingId: string; status: BookingStatus }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState<ActionKey | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const available = AVAILABLE[status];
  if (!available) return null;

  function run(key: ActionKey) {
    setError(null);
    startTransition(async () => {
      try {
        const result = await ACTIONS[key].run(bookingId);
        if (result.error) { setError(result.error); setConfirming(null); return; }
        router.refresh();
      } catch {
        setError("Something went wrong. Please try again.");
        setConfirming(null);
      }
    });
  }

  if (confirming) {
    const action = ACTIONS[confirming];
    return (
      <div className="booking-confirm" role="group" aria-label="Confirm">
        <p>{action.text}</p>
        <div className="booking-confirm-actions">
          <Button type="button" variant={confirming === "reject" ? "secondary" : "primary"} disabled={pending} onClick={() => run(confirming)}>
            {pending ? "Working…" : action.confirmLabel}
          </Button>
          <Button type="button" variant="ghost" disabled={pending} onClick={() => setConfirming(null)}>Cancel</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="booking-actions">
      {error && <Notice tone="error">{error}</Notice>}
      <div className="booking-confirm-actions">
        {available.map((key, index) => (
          <Button key={key} type="button" variant={index === 0 ? "primary" : "secondary"} onClick={() => setConfirming(key)}>
            {ACTIONS[key].label}
          </Button>
        ))}
      </div>
    </div>
  );
}
