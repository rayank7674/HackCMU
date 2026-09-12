import Link from "next/link";
import type { ButtonHTMLAttributes, ReactNode } from "react";

const variants = {
  primary:
    "bg-accent-strong text-white shadow-[0_8px_24px_rgba(30,79,134,0.22)] hover:bg-accent active:scale-[0.98]",
  secondary:
    "border border-border bg-surface text-foreground hover:bg-surface-elevated active:scale-[0.98]",
  ghost:
    "bg-transparent text-muted hover:bg-surface-elevated hover:text-foreground active:scale-[0.98]",
} as const;

type ButtonVariant = keyof typeof variants;

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
  href?: string;
  variant?: ButtonVariant;
};

function classes(variant: ButtonVariant, className?: string) {
  return [
    "inline-flex h-12 w-full items-center justify-center rounded-2xl px-4 text-sm font-semibold transition disabled:pointer-events-none disabled:opacity-50",
    variants[variant],
    className,
  ]
    .filter(Boolean)
    .join(" ");
}

export function Button({
  children,
  className,
  href,
  variant = "primary",
  type = "button",
  disabled,
  ...rest
}: ButtonProps) {
  if (href && !disabled) {
    return (
      <Link href={href} className={classes(variant, className)}>
        {children}
      </Link>
    );
  }

  return (
    <button
      type={type}
      className={classes(variant, className)}
      disabled={disabled}
      {...rest}
    >
      {children}
    </button>
  );
}
