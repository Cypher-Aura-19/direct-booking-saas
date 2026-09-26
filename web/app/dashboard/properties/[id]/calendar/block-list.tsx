"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/notice";
import { Stamp } from "@/components/ui/stamp";
import { addDays, nightsBetween } from "@/lib/availability/dates";
import type { Block } from "@/lib/availability/blocks";
import { deleteBlockAction } from "../../actions";

const DAY_MONTH = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });

function describe(block: Block): string {
  const lastNight = addDays(block.end, -1);
  const nights = nightsBetween(block.start, block.end);
  const year = block.end.slice(0, 4);
  const from = DAY_MONTH.format(new Date(`${block.start}T00:00:00Z`));
  const to = DAY_MONTH.format(new Date(`${lastNight}T00:00:00Z`));
  return `${from} – ${to} ${year} · ${nights} ${nights === 1 ? "night" : "nights"}`;
}

export function BlockList({ propertyId, blocks }: { propertyId: string; blocks: Block[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);

  function remove(blockId: string) {
    setError(null);
    setRemovingId(blockId);
    startTransition(async () => {
      const result = await deleteBlockAction(propertyId, blockId);
      if (result.error) {
        setError(result.error);
      } else {
        router.refresh();
      }
    });
  }

  if (blocks.length === 0) {
    return <p className="px-5 py-8 text-center text-sm text-muted sm:px-6">No blocked dates. Your calendar is open.</p>;
  }

  return (
    <div className="flex flex-col">
      {error && (
        <div className="px-5 pt-4 sm:px-6">
          <Notice tone="error">{error}</Notice>
        </div>
      )}
      <ul className="divide-y divide-hairline">
        {blocks.map((block) => (
          <li key={block.id} className="flex items-center justify-between gap-4 px-5 py-4 sm:px-6">
            <span className="text-sm text-ink">{describe(block)}</span>
            {block.reason === "booking" ? (
              <Stamp tone="green">Booking</Stamp>
            ) : (
              <Button
                variant="ghost"
                className="min-h-10 px-3 text-destructive hover:bg-destructive/[0.07]"
                disabled={pending && removingId === block.id}
                onClick={() => remove(block.id)}
              >
                {pending && removingId === block.id ? "Removing…" : "Remove"}
              </Button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
