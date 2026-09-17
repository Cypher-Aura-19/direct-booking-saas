type Tone = "danger" | "success";

const TONE_CLASS: Record<Tone, string> = {
  danger: "bg-danger-tint text-danger",
  success: "bg-primary-tint text-primary-hover",
};

export function Alert({ tone, children }: { tone: Tone; children: React.ReactNode }) {
  return <p className={`rounded-lg px-3 py-2 text-sm ${TONE_CLASS[tone]}`}>{children}</p>;
}
