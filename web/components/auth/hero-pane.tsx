const MOUNTAIN_MARK = (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
    <path d="M3 18L9 8L13 14L16 9L21 18H3Z" fill="white" />
  </svg>
);

export type Step = { label: string };

export const ONBOARDING_STEPS: Step[] = [
  { label: "Create your account" },
  { label: "Set up your organization" },
  { label: "Add your first property" },
];

export function HeroPane({
  eyebrow,
  title,
  subtitle,
  steps,
  activeStep,
}: {
  eyebrow: string;
  title: React.ReactNode;
  subtitle: string;
  steps?: Step[];
  activeStep?: number;
}) {
  return (
    <div
      className="relative flex flex-col justify-between overflow-hidden p-10 sm:p-12"
      style={{
        background:
          "radial-gradient(120% 90% at 15% 100%, #0f1a5c 0%, #1c2f8f 35%, transparent 70%), " +
          "radial-gradient(90% 80% at 90% 10%, #56c2f2 0%, #2f6fe0 45%, transparent 75%), " +
          "linear-gradient(160deg, #16225e 0%, #2547c9 55%, #3a7fe0 100%)",
      }}
    >
      <div className="flex items-center gap-2">
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white/15">
          {MOUNTAIN_MARK}
        </span>
        <span className="text-sm font-semibold text-white">Host Dashboard</span>
      </div>

      <div className="space-y-5">
        <span className="inline-flex items-center rounded-full border border-white/20 bg-white/10 px-3.5 py-1.5 text-sm text-white">
          {eyebrow}
        </span>
        <h1 className="max-w-sm text-4xl font-bold leading-[1.1] text-white">{title}</h1>
        <p className="max-w-sm text-white/75">{subtitle}</p>
      </div>

      {steps ? (
        <div className="flex gap-2">
          {steps.map((step, index) => {
            const isActive = index === activeStep;
            return (
              <div
                key={step.label}
                className={`flex-1 rounded-xl p-4 transition-colors ${
                  isActive ? "bg-white" : "bg-white/15"
                } ${index === 0 ? "flex-[1.3]" : ""}`}
              >
                <span
                  className={`mb-3 flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold ${
                    isActive ? "bg-[#2547c9] text-white" : "bg-white/25 text-white"
                  }`}
                >
                  {index + 1}
                </span>
                <p className={`text-sm font-medium leading-snug ${isActive ? "text-[#16225e]" : "text-white/85"}`}>
                  {step.label}
                </p>
              </div>
            );
          })}
        </div>
      ) : (
        <div />
      )}
    </div>
  );
}
