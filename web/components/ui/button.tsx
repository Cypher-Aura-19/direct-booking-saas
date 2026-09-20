import type { ButtonHTMLAttributes } from "react";

export type ButtonVariant = "primary" | "secondary" | "ghost";

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary: "bg-accent text-accent-contrast hover:opacity-90",
  secondary:
    "bg-surface text-ink border border-hairline hover:bg-surface-muted",
  ghost: "bg-transparent text-ink hover:bg-surface-muted",
};

// min-h-11 is 44px: the minimum comfortable touch target on a phone.
const BASE_CLASSES =
  "inline-flex min-h-11 items-center justify-center rounded-pill px-6 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
};

export function Button({
  variant = "primary",
  className = "",
  ...props
}: ButtonProps) {
  return (
    <button
      className={`${BASE_CLASSES} ${VARIANT_CLASSES[variant]} ${className}`.trim()}
      {...props}
    />
  );
}
