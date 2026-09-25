"use client";

import { useActionState, useState } from "react";
import { Wordmark } from "@/components/brand/wordmark";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { INPUT_CLASSES } from "@/components/ui/input";
import { Notice } from "@/components/ui/notice";
import { Stamp } from "@/components/ui/stamp";
import { IconArrowRight } from "@/components/ui/icons";
import { onboardingAction, checkSlugAction } from "./actions";

const STEPS = [
  { title: "Your business", detail: "Name, link, city and phone" },
  { title: "First property", detail: "Name, address and nightly rate" },
  { title: "Photos and knowledge base", detail: "What your AI assistant answers from" },
  { title: "Publish and share", detail: "One link for Instagram and WhatsApp" },
];

export default function OnboardingPage() {
  const [state, formAction, pending] = useActionState(onboardingAction, { error: null });
  const [slugStatus, setSlugStatus] = useState<"idle" | "checking" | "available" | "taken">("idle");
  const [slug, setSlug] = useState("");

  async function handleSlugBlur(event: React.FocusEvent<HTMLInputElement>) {
    const slug = event.target.value.trim();
    if (!slug) {
      setSlugStatus("idle");
      return;
    }
    setSlugStatus("checking");
    const { available } = await checkSlugAction(slug);
    setSlugStatus(available ? "available" : "taken");
  }

  return (
    <div className="grid min-h-dvh lg:grid-cols-[minmax(20rem,26rem)_1fr]">
      <aside className="bg-accent-soft flex flex-col gap-10 px-6 py-8 text-ink sm:px-10 lg:py-10">
        <Wordmark />
        <div className="hidden flex-col gap-8 lg:flex">
          <div className="flex flex-col gap-3">
            <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted">Setting up</p>
            <p className="text-balance text-2xl font-medium leading-snug tracking-[-0.02em]">
              Four entries and your booking page is ready to share.
            </p>
          </div>
          <ol className="flex flex-col">
            {STEPS.map((step, index) => {
              const current = index === 0;
              return (
                <li key={step.title} className="flex gap-4 border-t border-hairline py-4 first:border-t-0">
                  <span
                    className={`grid size-8 shrink-0 place-items-center rounded-full font-mono text-xs ${
                      current ? "bg-accent text-accent-contrast" : "border border-ruling text-muted"
                    }`}
                  >
                    {index + 1}
                  </span>
                  <span className="flex flex-col gap-0.5">
                    <span className={current ? "font-medium text-ink" : "text-ink/80"}>{step.title}</span>
                    <span className="text-sm text-muted">{step.detail}</span>
                  </span>
                </li>
              );
            })}
          </ol>
        </div>
        <p className="mt-auto hidden text-sm leading-6 text-muted lg:block">
          Guests never need an account. They tap your link, chat, pick dates and pay the advance straight to you.
        </p>
      </aside>

      <main className="flex items-start justify-center bg-surface px-6 py-10 sm:px-10 lg:items-center lg:py-16">
        <div className="w-full max-w-lg animate-rise">
          <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted lg:hidden">Step 1 of 4</p>
          <h1 className="mt-2 text-balance text-[2rem] font-semibold leading-[1.15] tracking-[-0.03em] sm:text-[2.35rem] lg:mt-0">
            Set up your business
          </h1>
          <p className="mt-3 text-[15px] leading-6 text-muted">
            This is what guests see at the top of your catalogue. You can change any of it later in Settings.
          </p>

          <form action={formAction} className="mt-9 flex flex-col gap-5">
            <Field label="Business name">
              <input
                name="name"
                type="text"
                required
                placeholder="Altit Heights Guest House"
                className={INPUT_CLASSES}
              />
            </Field>

            <Field
              label="Public slug"
              status={
                <>
                  {slugStatus === "checking" && <span className="text-xs font-normal text-muted">Checking…</span>}
                  {slugStatus === "available" && (
                    <Stamp tone="green" tilt={-3} pressed>
                      Available
                    </Stamp>
                  )}
                  {slugStatus === "taken" && (
                    <Stamp tone="red" tilt={-3} pressed>
                      Already taken
                    </Stamp>
                  )}
                </>
              }
              hint={
                <>
                  Your catalogue link:{" "}
                  <span className="font-mono text-ink">/s/{slug.trim() || "your-slug"}</span>
                </>
              }
            >
              <input
                name="slug"
                type="text"
                required
                autoCapitalize="none"
                spellCheck={false}
                placeholder="altit-heights"
                onChange={(event) => setSlug(event.target.value)}
                onBlur={handleSlugBlur}
                aria-invalid={slugStatus === "taken" || undefined}
                className={`${INPUT_CLASSES} font-mono`}
              />
            </Field>

            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="City">
                <input name="city" type="text" required placeholder="Hunza" className={INPUT_CLASSES} />
              </Field>
              <Field label="Phone">
                <input
                  name="phone"
                  type="tel"
                  required
                  inputMode="tel"
                  placeholder="0300 1234567"
                  className={`${INPUT_CLASSES} font-mono`}
                />
              </Field>
            </div>

            {state.error && <Notice tone="error">{state.error}</Notice>}

            <div className="mt-3 flex flex-col-reverse items-stretch gap-4 border-t border-hairline pt-6 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-muted">Next, you add your first property from the dashboard.</p>
              <Button type="submit" disabled={pending}>
                {pending ? "Creating…" : "Continue"}
                {!pending && <IconArrowRight />}
              </Button>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
}
