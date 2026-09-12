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
        "rounded-3xl border border-border bg-surface p-4 shadow-[0_10px_30px_rgba(16,35,61,0.06)]",
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
