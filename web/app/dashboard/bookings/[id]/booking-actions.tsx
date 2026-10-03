"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/notice";
import { approveBookingAction, rejectBookingAction } from "../actions";

type Pending = "approve" | "reject" | null;

export function BookingActions({ bookingId }: { bookingId: string }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState<Pending>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function run(kind: "approve" | "reject") {
    setError(null);
    startTransition(async () => {
      try {
        const result = await (kind === "approve" ? approveBookingAction(bookingId) : rejectBookingAction(bookingId));
        if (result.error) { setError(result.error); setConfirming(null); return; }
        router.refresh();
      } catch {
        setError("Something went wrong. Please try again.");
        setConfirming(null);
      }
    });
  }

  if (confirming) {
    const approving = confirming === "approve";
    return (
      <div className="booking-confirm" role="group" aria-label="Confirm">
        <p>
          {approving
            ? "Approve and lock these dates? The AI will go quiet in this chat and the guest will see your payment details."
            : "Reject this request? The guest is told it wasn't accepted and the calendar stays as it is."}
        </p>
        <div className="booking-confirm-actions">
          <Button type="button" variant={approving ? "primary" : "secondary"} disabled={pending} onClick={() => run(confirming)}>
            {pending ? "Working…" : approving ? "Confirm approval" : "Confirm rejection"}
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
        <Button type="button" onClick={() => setConfirming("approve")}>Approve</Button>
        <Button type="button" variant="secondary" onClick={() => setConfirming("reject")}>Reject</Button>
      </div>
    </div>
  );
}
