"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/notice";
import { shortenRetentionAction } from "../actions";

// Shortening only: `max` is the cap day (checkout + 90 days).
export function RetentionForm({ recordId, min, max }: { recordId: string; min: string; max: string }) {
  const router = useRouter();
  const [date, setDate] = useState(max);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function save() {
    setError(null);
    startTransition(async () => {
      const result = await shortenRetentionAction(recordId, date);
      if (result.error) setError(result.error);
      else router.refresh();
    });
  }

  return (
    <div className="retention-form">
      <label>
        Delete this record on
        <input type="date" value={date} min={min} max={max} onChange={(e) => setDate(e.target.value)} />
      </label>
      {error && <Notice tone="error">{error}</Notice>}
      <Button type="button" variant="secondary" disabled={pending || !date} onClick={save}>
        {pending ? "Saving…" : "Shorten retention"}
      </Button>
    </div>
  );
}
