"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { INPUT_CLASSES } from "@/components/ui/input";
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
    <form action={formAction} className="flex max-w-xl flex-col gap-10">
      <p className="text-muted">
        Guests never see this page. Your AI assistant answers their questions from it, so write the way you would
        explain it on the phone. Wifi and gate codes stay private until a guest&apos;s stay begins.
      </p>

      {KNOWLEDGE_BASE_SECTIONS.map((section) => (
        <fieldset key={section.title} className="flex flex-col gap-4">
          <legend className="mb-2 text-sm font-medium text-muted">{section.title}</legend>
          {section.fields.map((field) => (
            <label key={field.key} className="flex flex-col gap-1 text-sm">
              {field.label}
              {field.kind === "long" ? (
                <textarea
                  name={field.key}
                  rows={3}
                  maxLength={2000}
                  defaultValue={knowledgeBase[field.key] ?? ""}
                  className={INPUT_CLASSES}
                />
              ) : (
                <input
                  name={field.key}
                  type={field.kind === "time" ? "time" : "text"}
                  maxLength={field.kind === "time" ? undefined : 200}
                  defaultValue={knowledgeBase[field.key] ?? ""}
                  className={INPUT_CLASSES}
                />
              )}
            </label>
          ))}
        </fieldset>
      ))}

      {state.error && <p className="text-sm text-destructive">{state.error}</p>}
      {state.success && <p className="text-sm text-success">Saved.</p>}
      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : "Save knowledge base"}
      </Button>
    </form>
  );
}
