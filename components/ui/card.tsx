import type { ReactNode } from "react";

type CardProps = {
  title?: string;
  eyebrow?: string;
  children: ReactNode;
  className?: string;
};

export function Card({ title, eyebrow, children, className }: CardProps) {
  return (
    <section
      className={[
        "sr-card-motion rounded-2xl border border-border bg-surface p-4",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {eyebrow ? (
        <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted">
          {eyebrow}
        </p>
      ) : null}
      {title ? (
        <h2 className="mt-1 text-base font-semibold text-foreground">{title}</h2>
      ) : null}
      <div className={title || eyebrow ? "mt-2 text-sm leading-relaxed text-muted" : ""}>
        {children}
      </div>
    </section>
  );
}
