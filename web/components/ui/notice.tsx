import { IconAlert, IconCheck } from "./icons";

// Form feedback. Errors are announced; success lands with the stamp motion.
export function Notice({ tone, children }: { tone: "error" | "success"; children: React.ReactNode }) {
  const isError = tone === "error";
  return (
    <p
      role={isError ? "alert" : "status"}
      className={`flex items-start gap-2.5 rounded-[var(--radius-field)] px-3.5 py-3 text-sm leading-5 animate-rise ${
        isError ? "bg-destructive/[0.07] text-destructive" : "bg-success/[0.08] text-success"
      }`}
    >
      {isError ? <IconAlert className="mt-px size-4 shrink-0" /> : <IconCheck className="mt-px size-4 shrink-0" />}
      <span>{children}</span>
    </p>
  );
}
