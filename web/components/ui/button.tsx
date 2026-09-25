import type { ButtonHTMLAttributes } from "react";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary:
    "bg-action text-ink hover:bg-action-hover active:translate-y-px",
  secondary:
    "bg-surface text-ink border border-hairline shadow-[0_1px_2px_rgb(20_24_36/0.05)] hover:border-ruling hover:bg-surface-muted",
  ghost: "bg-transparent text-ink hover:bg-ink/[0.05]",
  danger: "bg-transparent text-destructive border border-destructive/25 hover:bg-destructive/[0.06]",
};

// min-h-11 is 44px: the minimum comfortable touch target on a phone.
export const BUTTON_BASE_CLASSES =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-pill whitespace-nowrap px-6 text-sm font-medium transition duration-200 ease-out disabled:pointer-events-none disabled:opacity-50";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
};

export function buttonClasses(variant: ButtonVariant = "primary", className = "") {
  return `${BUTTON_BASE_CLASSES} ${VARIANT_CLASSES[variant]} ${className}`.trim();
}

export function Button({
  variant = "primary",
  className = "",
  ...props
}: ButtonProps) {
  return <button className={buttonClasses(variant, className)} {...props} />;
}
