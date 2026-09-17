import Link from "next/link";
import type { ComponentProps } from "react";

type Variant = "primary" | "secondary" | "ghost";

const VARIANT_CLASS: Record<Variant, string> = {
  primary: "bg-primary text-primary-foreground hover:bg-primary-hover",
  secondary: "bg-transparent text-foreground border border-border hover:border-primary hover:text-primary",
  ghost: "bg-transparent text-muted-foreground hover:text-foreground",
};

const BASE =
  "inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors disabled:opacity-50 disabled:pointer-events-none";

export function Button({
  variant = "primary",
  className = "",
  ...props
}: ComponentProps<"button"> & { variant?: Variant }) {
  return <button className={`${BASE} ${VARIANT_CLASS[variant]} ${className}`} {...props} />;
}

export function ButtonLink({
  variant = "primary",
  className = "",
  ...props
}: ComponentProps<typeof Link> & { variant?: Variant }) {
  return <Link className={`${BASE} ${VARIANT_CLASS[variant]} ${className}`} {...props} />;
}
