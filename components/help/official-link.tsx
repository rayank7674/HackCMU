import type { OfficialLink as OfficialLinkData } from "@/lib/help/content";

type OfficialLinkProps = {
  link: OfficialLinkData;
};

export function OfficialLink({ link }: OfficialLinkProps) {
  return (
    <li className="border-t border-border pt-3 first:border-t-0 first:pt-0">
      <a
        href={link.href}
        target="_blank"
        rel="noopener noreferrer"
        className="font-semibold text-accent-strong underline-offset-2 hover:underline"
      >
        {link.title}
      </a>
      <p className="mt-1 text-sm leading-relaxed text-muted">{link.description}</p>
      <p className="mt-1 text-[11px] font-medium uppercase tracking-[0.18em] text-muted">
        Source: {link.source}
      </p>
    </li>
  );
}

export function OfficialLinkList({ links }: { links: OfficialLinkData[] }) {
  return (
    <ul className="mt-1">
      {links.map((link) => (
        <OfficialLink key={link.id} link={link} />
      ))}
    </ul>
  );
}
