import { Header } from "@/components/layout/header";
import { OfficialLinkList } from "@/components/help/official-link";
import { Card } from "@/components/ui/card";
import {
  DATA_AND_TRUST,
  FINANCIAL_ASSISTANCE_INTRO,
  FINANCIAL_LINKS,
  HOW_STORMREADY_WORKS,
  LOCAL_HELP_EXAMPLE_NOTE,
  LOCAL_HELP_INTRO,
  LOCAL_HELP_LINKS,
  PREPAREDNESS_LINKS,
  SAFETY_DISCLAIMER,
} from "@/lib/help/content";

export default function HelpPage() {
  return (
    <main className="flex min-h-full flex-1 flex-col">
      <Header title="Help" />
      <div className="flex flex-1 flex-col gap-3 px-5 pb-8 pt-4">
        <Card title="How StormReady works">
          <ol className="list-decimal space-y-2 pl-4 text-sm leading-relaxed text-muted">
            {HOW_STORMREADY_WORKS.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
        </Card>

        <Card title="Official preparedness & alerts">
          <OfficialLinkList links={PREPAREDNESS_LINKS} />
        </Card>

        <Card title="Find local help">
          <p>{LOCAL_HELP_INTRO}</p>
          <p className="mt-2">{LOCAL_HELP_EXAMPLE_NOTE}</p>
          <OfficialLinkList links={LOCAL_HELP_LINKS} />
        </Card>

        <Card title="Financial assistance">
          <p>{FINANCIAL_ASSISTANCE_INTRO}</p>
          <OfficialLinkList links={FINANCIAL_LINKS} />
        </Card>

        <Card title="Safety">
          <p>{SAFETY_DISCLAIMER}</p>
        </Card>

        <Card title="Trust">
          <ul className="list-disc space-y-2 pl-4">
            {DATA_AND_TRUST.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </Card>
      </div>
    </main>
  );
}
