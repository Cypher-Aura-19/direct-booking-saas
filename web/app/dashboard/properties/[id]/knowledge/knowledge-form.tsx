"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { IconSparkle } from "@/components/ui/icons";
import { INPUT_CLASSES } from "@/components/ui/input";
import { Notice } from "@/components/ui/notice";
import { Sheet } from "@/components/ui/page-header";
import { Stamp } from "@/components/ui/stamp";
import { KNOWLEDGE_BASE_SECTIONS, type KnowledgeBase } from "@/lib/properties/knowledge-base";
import type { FormState } from "../../actions";

export function KnowledgeForm({
  action,
  knowledgeBase,
}: {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  knowledgeBase: KnowledgeBase;
}) {
  const [state, formAction, pending] = useActionState(action, { error: null, success: false });

  return (
    <form action={formAction} className="flex flex-col gap-6">
      <div className="flex items-start gap-4 rounded-card bg-accent-soft px-5 py-5 text-ink sm:px-6">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-surface text-accent">
          <IconSparkle className="size-5" />
        </span>
        <p className="max-w-[68ch] text-[15px] leading-6 text-muted">
          Guests never see this page. Your AI assistant answers their questions from it, so write the way you would
          explain it on the phone. Wifi and gate codes stay private until a guest&apos;s stay begins.
        </p>
      </div>

      {KNOWLEDGE_BASE_SECTIONS.map((section) => {
        const isPrivate = section.fields.some((field) => field.key === "wifi_password" || field.key === "gate_code");
        return (
          <Sheet key={section.title} as="div">
            <fieldset>
              <legend className="sr-only">{section.title}</legend>
              <div className="flex items-center justify-between gap-4 border-b border-hairline px-5 py-4 sm:px-6">
                <h2 className="text-base font-semibold tracking-[-0.01em] text-ink" aria-hidden="true">
                  {section.title}
                </h2>
                {isPrivate && (
                  <Stamp tone="violet" tilt={-3}>
                    Private until check-in
                  </Stamp>
                )}
              </div>
              <div className="grid gap-5 p-5 sm:grid-cols-2 sm:p-6">
                {section.fields.map((field) => (
                  <Field key={field.key} label={field.label} className={field.kind === "long" ? "sm:col-span-2" : ""}>
                    {field.kind === "long" ? (
                      <textarea
                        name={field.key}
                        rows={3}
                        maxLength={2000}
                        defaultValue={knowledgeBase[field.key] ?? ""}
                        className={`${INPUT_CLASSES} resize-y leading-6`}
                      />
                    ) : (
                      <input
                        name={field.key}
                        type={field.kind === "time" ? "time" : "text"}
                        maxLength={field.kind === "time" ? undefined : 200}
                        defaultValue={knowledgeBase[field.key] ?? ""}
                        className={`${INPUT_CLASSES} ${field.kind === "time" ? "font-mono" : ""}`}
                      />
                    )}
                  </Field>
                ))}
              </div>
            </fieldset>
          </Sheet>
        );
      })}

      <div className="sticky bottom-20 z-10 flex flex-col gap-3 rounded-card border border-hairline bg-surface/95 p-3 shadow-[var(--shadow-lift)] backdrop-blur-md sm:flex-row sm:items-center sm:justify-between md:bottom-4">
        <div className="min-w-0 flex-1 px-2">
          {state.error ? (
            <Notice tone="error">{state.error}</Notice>
          ) : state.success ? (
            <Notice tone="success">Saved.</Notice>
          ) : (
            <p className="text-sm text-muted">Fill in what you can. You can come back and add more any time.</p>
          )}
        </div>
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save knowledge base"}
        </Button>
      </div>
    </form>
  );
}
