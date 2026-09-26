"use client";

import { useRouter } from "next/navigation";
import { useActionState, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { INPUT_CLASSES } from "@/components/ui/input";
import { Notice } from "@/components/ui/notice";
import { addDays } from "@/lib/availability/dates";
import type { SeasonalRule } from "@/lib/availability/pricing";
import { formatRupees } from "@/lib/properties/basics";
import { deleteSeasonalRuleAction } from "../../actions";
import type { FormState } from "../../actions";

const DAY_MONTH = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });

function describeRange(rule: SeasonalRule): string {
  const lastNight = addDays(rule.end, -1);
  const year = rule.end.slice(0, 4);
  const from = DAY_MONTH.format(new Date(`${rule.start}T00:00:00Z`));
  const to = DAY_MONTH.format(new Date(`${lastNight}T00:00:00Z`));
  return `${from} – ${to} ${year}`;
}

export function RulesSection({
  action,
  propertyId,
  rules,
  baseRateCents,
  today,
}: {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  propertyId: string;
  rules: SeasonalRule[];
  baseRateCents: number;
  today: string;
}) {
  const [state, formAction, pending] = useActionState(action, { error: null, success: false });
  const router = useRouter();
  const [removing, startRemoving] = useTransition();
  const [removeError, setRemoveError] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);

  function remove(ruleId: string) {
    setRemoveError(null);
    setRemovingId(ruleId);
    startRemoving(async () => {
      const result = await deleteSeasonalRuleAction(propertyId, ruleId);
      if (result.error) {
        setRemoveError(result.error);
      } else {
        router.refresh();
      }
    });
  }

  return (
    <div className="flex flex-col gap-6 p-5 sm:p-6">
      <form action={formAction} className="flex flex-col gap-5">
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="First night">
            <input name="firstNight" type="date" min={today} required className={`${INPUT_CLASSES} font-mono`} />
          </Field>
          <Field label="Last night">
            <input name="lastNight" type="date" min={today} required className={`${INPUT_CLASSES} font-mono`} />
          </Field>
          <Field label="Nightly rate (Rs)">
            <input name="rate" type="number" inputMode="numeric" min={1} step={1} required placeholder="20000" className={`${INPUT_CLASSES} font-mono`} />
          </Field>
          <Field label="Minimum stay">
            <input name="minimumStay" type="number" inputMode="numeric" min={1} max={60} placeholder="1" className={`${INPUT_CLASSES} font-mono`} />
          </Field>
        </div>
        {state.error && <Notice tone="error">{state.error}</Notice>}
        {state.success && <Notice tone="success">Season added.</Notice>}
        <div>
          <Button type="submit" disabled={pending}>
            {pending ? "Adding…" : "Add season"}
          </Button>
        </div>
      </form>

      <div className="flex flex-col border-t border-hairline pt-2">
        {removeError && <Notice tone="error">{removeError}</Notice>}
        {rules.length === 0 ? (
          <p className="px-1 py-8 text-center text-sm text-muted">
            No seasonal rates. Every night uses your base rate of {formatRupees(baseRateCents)}.
          </p>
        ) : (
          <ul className="divide-y divide-hairline">
            {rules.map((rule) => (
              <li key={rule.id} className="flex items-center justify-between gap-4 py-4">
                <span className="text-sm text-ink">
                  {describeRange(rule)} · {formatRupees(rule.rateCents)} / night
                  {rule.minimumStay > 1 ? ` · min ${rule.minimumStay} nights` : ""}
                </span>
                <Button
                  variant="ghost"
                  className="min-h-11 px-3 text-destructive hover:bg-destructive/[0.07]"
                  disabled={removing && removingId === rule.id}
                  onClick={() => remove(rule.id)}
                >
                  {removing && removingId === rule.id ? "Removing…" : "Remove"}
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
