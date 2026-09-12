import Link from "next/link";

type HeaderProps = {
  title: string;
  backHref?: string;
};

export function Header({ title, backHref }: HeaderProps) {
  return (
    <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-border bg-background/90 px-4 py-3 pt-[max(0.75rem,env(safe-area-inset-top))] backdrop-blur">
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
      <h1 className="flex-1 text-center text-sm font-semibold tracking-wide">
        {title}
      </h1>
      <span className="h-9 w-9" />
    </header>
  );
}
