"use client";

import { OfficialLinkList } from "@/components/help/official-link";
import { LoadingCard } from "@/components/stormready/query-state";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  DATA_AND_TRUST,
  FINANCIAL_ASSISTANCE_INTRO,
  FINANCIAL_LINKS,
  HOW_FAULTLINE_WORKS,
  LOCAL_HELP_EXAMPLE_NOTE,
  LOCAL_HELP_INTRO,
  LOCAL_HELP_LINKS,
  PREPAREDNESS_LINKS,
  SAFETY_DISCLAIMER,
} from "@/lib/help/content";
import {
  resolveLocalHelp,
  type LocalNumber,
} from "@/lib/help/local-numbers";
import { formatLocation } from "@/lib/stormready-format";
import { useProfile } from "@/lib/use-profile";

export function HelpView() {
  const { profile, hydrated } = useProfile();
  const home = profile.home ?? null;
  const local = resolveLocalHelp(home);
  const showRegionalNote = local.links.some((link) =>
    /example/i.test(link.source),
  );

  if (!hydrated) {
    return (
      <main className="flex flex-1 flex-col">
        <div className="px-5 py-8">
          <LoadingCard title="Help" label="Loading this device…" lines={2} />
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-full flex-1 flex-col">
      <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-4 px-5 pb-8 pt-4">
        <section>
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-accent">
            For this address
          </p>
          <h2 className="mt-1 text-xl font-semibold tracking-tight text-foreground">
            {formatLocation(home)}
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-muted">
            {LOCAL_HELP_INTRO}
          </p>
          {local.missingNote ? (
            <p className="mt-2 text-xs leading-relaxed text-muted">{local.missingNote}</p>
          ) : null}
          {!local.placeKnown ? (
            <div className="mt-3">
              <Button href="/onboarding" variant="secondary">
                Add an address
              </Button>
            </div>
          ) : null}
        </section>

        <Card eyebrow="Call or look up" title="Local numbers">
          <ul className="space-y-3">
            {local.numbers.map((item) => (
              <LocalNumberRow key={item.id} item={item} />
            ))}
          </ul>
        </Card>

        <Card title="Official pages">
          {showRegionalNote ? (
            <p className="mb-2 text-xs leading-relaxed">{LOCAL_HELP_EXAMPLE_NOTE}</p>
          ) : null}
          <OfficialLinkList
            links={[...PREPAREDNESS_LINKS, ...LOCAL_HELP_LINKS, ...local.links]}
          />
        </Card>

        <Card title="Financial assistance">
          <p>{FINANCIAL_ASSISTANCE_INTRO}</p>
          <OfficialLinkList links={FINANCIAL_LINKS} />
        </Card>

        <details className="rounded-2xl border border-border bg-surface p-4">
          <summary className="cursor-pointer text-sm font-semibold text-foreground">
            How FaultLine works
          </summary>
          <ol className="mt-3 list-decimal space-y-2 pl-4 text-sm leading-relaxed text-muted">
            {HOW_FAULTLINE_WORKS.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
        </details>

        <p className="text-xs leading-relaxed text-muted">{SAFETY_DISCLAIMER}</p>
        <ul className="list-disc space-y-1 pl-4 text-xs leading-relaxed text-muted">
          {DATA_AND_TRUST.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      </div>
    </main>
  );
}

function LocalNumberRow({ item }: { item: LocalNumber }) {
  const href = item.tel ? `tel:${item.tel}` : item.href;
  return (
    <li className="border-t border-border pt-3 first:border-t-0 first:pt-0">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted">
            {item.scope === "county"
              ? "County"
              : item.scope === "state"
                ? "State"
                : "National"}
          </p>
          <p className="mt-0.5 text-sm font-semibold text-foreground">{item.label}</p>
          <p className="mt-1 text-xs leading-relaxed text-muted">{item.note}</p>
          <p className="mt-1 text-[11px] font-medium uppercase tracking-[0.14em] text-muted">
            Source: {item.source}
          </p>
        </div>
        {href ? (
          <a
            href={href}
            className="shrink-0 rounded-full bg-accent-strong px-3 py-1.5 text-sm font-semibold text-background"
            {...(href.startsWith("tel:")
              ? {}
              : { target: "_blank", rel: "noopener noreferrer" })}
          >
            {item.display}
          </a>
        ) : (
          <span className="shrink-0 text-sm font-semibold text-foreground">
            {item.display}
          </span>
        )}
      </div>
    </li>
  );
}
