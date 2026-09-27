"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { IconSparkle } from "@/components/ui/icons";
import { INPUT_CLASSES } from "@/components/ui/input";
import { Notice } from "@/components/ui/notice";
import { Sheet, SheetHeader } from "@/components/ui/page-header";
import { AI_SWITCHES, type AiSettings } from "@/lib/properties/ai-settings";
import type { FormState } from "../../actions";

export function AiSettingsForm({
  action,
  settings,
}: {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  settings: AiSettings;
}) {
  const [state, formAction, pending] = useActionState(action, { error: null, success: false });

  return (
    <form id="ai-settings-form" action={formAction} className="flex flex-col gap-6">
      <div className="flex items-start gap-4 rounded-card bg-accent-soft px-5 py-5 text-ink sm:px-6">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-surface text-accent">
          <IconSparkle className="size-5" />
        </span>
        <p className="max-w-[68ch] text-[15px] leading-6 text-muted">
          Turn off anything you&apos;d rather answer yourself. A guest asking about something that&apos;s off is told
          the host will get back to them — the assistant never guesses.
        </p>
      </div>

      <Sheet as="div">
        <SheetHeader title="What the assistant can do" />
        <div className="flex flex-col divide-y divide-hairline">
          {AI_SWITCHES.map((s) => (
            <label key={s.key} className="flex min-h-11 cursor-pointer items-start justify-between gap-4 px-5 py-4 sm:px-6">
              <span className="flex flex-col gap-0.5">
                <span className="text-sm font-medium text-ink">{s.label}</span>
                <span className="text-[13px] leading-5 text-muted">{s.hint}</span>
              </span>
              <input
                type="checkbox"
                name={s.key}
                defaultChecked={settings.switches[s.key]}
                className="mt-0.5 size-5 shrink-0 accent-[var(--accent)]"
              />
            </label>
          ))}
        </div>
      </Sheet>

      <Sheet as="div">
        <SheetHeader title="Never say this" description="A free-text rule the assistant will never violate, in any conversation." />
        <div className="p-5 sm:p-6">
          <label htmlFor="never-say" className="sr-only">Never say this</label>
          <textarea
            id="never-say"
            name="neverSay"
            rows={3}
            maxLength={500}
            defaultValue={settings.neverSay}
            placeholder="e.g. Never promise a refund. Never say the pool is heated."
            className={`${INPUT_CLASSES} resize-y leading-6`}
          />
        </div>
      </Sheet>

      <div className="sticky bottom-20 z-10 flex flex-col gap-3 rounded-card border border-hairline bg-surface/95 p-3 shadow-[var(--shadow-lift)] backdrop-blur-md sm:flex-row sm:items-center sm:justify-between md:bottom-4">
        <div className="min-w-0 flex-1 px-2">
          {state.error ? (
            <Notice tone="error">{state.error}</Notice>
          ) : state.success ? (
            <Notice tone="success">Saved.</Notice>
          ) : (
            <p className="text-sm text-muted">Test your changes below before saving, if you like.</p>
          )}
        </div>
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save AI settings"}
        </Button>
      </div>
    </form>
  );
}
