import Link from "next/link";

type HeaderProps = {
  title: string;
  backHref?: string;
  /** Slightly stronger title treatment (e.g. section label like PLAN). */
  emphatic?: boolean;
};

export function Header({ title, backHref, emphatic = false }: HeaderProps) {
  return (
    <header className="sr-page-header sticky top-0 z-20 flex items-center gap-3 border-b border-border/80 bg-gradient-to-b from-white to-blue-wash/80 px-4 py-3.5 pt-[max(0.85rem,env(safe-area-inset-top))] backdrop-blur">
      {backHref ? (
        <Link
          href={backHref}
          className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-border text-sm text-muted hover:bg-surface-elevated"
          aria-label="Go back"
        >
          ←
        </Link>
      ) : (
        <span className="h-9 w-9" />
      )}
      <h1
        className={
          emphatic
            ? "flex-1 text-center text-[13px] font-bold uppercase tracking-[0.28em] text-navy"
            : "flex-1 text-center text-sm font-semibold tracking-wide text-foreground"
        }
      >
        {title}
      </h1>
      <span className="h-9 w-9" />
    </header>
  );
}
