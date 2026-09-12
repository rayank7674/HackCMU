"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Modal } from "@/components/ui/modal";
import { UnavailableNote } from "@/components/stormready/unavailable-note";
import { usePlanData } from "@/components/stormready/plan-data";
import {
  SEVERITY_RANK,
  formatCostClass,
  formatHorizon,
  formatLocation,
  formatPriority,
  formatRelativeTime,
  formatSeverity,
  shortReason,
} from "@/lib/stormready-format";
import { isKnown, type ActiveHazard } from "@/lib/stormready";
import { useProfile } from "@/lib/use-profile";
import {
  fetchTampaDemo,
  type RecommendationView,
} from "@/lib/stormready-api";

export function PlanView() {
  const { profile, hydrated } = useProfile();
  const plan = usePlanData(profile, hydrated);
  const [why, setWhy] = useState<RecommendationView | null>(null);
  const [demoRecs, setDemoRecs] = useState<RecommendationView[] | null>(null);
  const [demoBusy, setDemoBusy] = useState(false);

  const primaryAlert = useMemo(
    () => pickPrimaryAlert(plan.alerts?.hazards ?? []),
    [plan.alerts],
  );

  if (!hydrated) {
    return (
      <main className="flex flex-1 flex-col">
        <Header title="Your plan" />
        <p className="px-5 py-8 text-sm text-muted">Loading your home…</p>
      </main>
    );
  }

  if (!profile.home && !profile.household) {
    return (
      <main className="flex flex-1 flex-col">
        <Header title="Your plan" />
        <div className="flex flex-1 flex-col px-5 pb-8 pt-6">
          <h2 className="text-2xl font-semibold tracking-tight">
            No plan on this device yet
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-muted">
            Answer a few questions about your home. StormReady stays anonymous
            and will not invent alerts.
          </p>
          <div className="mt-8">
            <Button href="/onboarding">Get Started</Button>
          </div>
        </div>
      </main>
    );
  }

  const topAction = plan.recommendations[0] ?? null;
  const lastUpdated =
    plan.alerts?.observedAt ?? profile.updatedAt ?? profile.home?.updatedAt ?? null;

  return (
    <main className="flex min-h-full flex-1 flex-col">
      <Header title="Your plan" />
      <div className="flex flex-1 flex-col gap-4 px-5 pb-8 pt-4">
        <section>
          <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted">
            Home summary
          </p>
          <h2 className="mt-1 text-lg font-semibold text-foreground">
            {formatLocation(profile.home)}
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-muted">
            Current alert: {summarizeAlert(plan, primaryAlert)}
          </p>
          <p className="mt-1 text-sm leading-relaxed text-muted">
            Top action:{" "}
            {plan.recommendationsUnavailable
              ? "Unavailable"
              : topAction
                ? topAction.title
                : plan.loading
                  ? "Checking…"
                  : "None confirmed"}
          </p>
          <p className="mt-1 text-xs text-muted">
            Last updated {formatRelativeTime(lastUpdated)}
          </p>
          <Link
            href="/onboarding"
            className="mt-3 inline-block text-sm font-semibold text-accent-strong"
          >
            Update home details
          </Link>
        </section>

        {plan.alertsUnavailable ? (
          <UnavailableNote title="Official alerts">
            Alert service is not connected yet. StormReady will not invent
            warnings or mark this area all-clear.
          </UnavailableNote>
        ) : plan.loading && !plan.alerts ? (
          <Card eyebrow="Official alerts" title="Checking…">
            Looking up products for your location.
          </Card>
        ) : (
          <AlertCard
            alert={primaryAlert}
            source={plan.alerts?.provenance}
            observedAt={plan.alerts?.observedAt ?? null}
            allClear={plan.alerts?.allClear ?? "unknown"}
            locationLabel={
              plan.alerts && isKnown(plan.alerts.locationLabel)
                ? plan.alerts.locationLabel
                : formatLocation(profile.home)
            }
          />
        )}

        <ConditionsRow
          unavailable={plan.alertsUnavailable}
          hazards={plan.alerts?.hazards ?? []}
          allClear={plan.alerts?.allClear ?? "unknown"}
        />

        <section>
          <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted">
            Actions
          </p>
          {plan.recommendationsUnavailable && !demoRecs ? (
            <div className="mt-2 space-y-3">
              <UnavailableNote title="Recommended actions">
                The plan service is not connected yet, or it failed closed
                because official alerts are unavailable. StormReady will not
                invent a live checklist.
              </UnavailableNote>
              <Button
                variant="secondary"
                disabled={demoBusy}
                onClick={async () => {
                  setDemoBusy(true);
                  const result = await fetchTampaDemo("quiet");
                  setDemoRecs(result.ok ? result.data.slice(0, 5) : []);
                  setDemoBusy(false);
                }}
              >
                {demoBusy ? "Loading Tampa demo…" : "View Tampa quiet demo"}
              </Button>
            </div>
          ) : demoRecs && demoRecs.length > 0 ? (
            <div className="mt-2 space-y-3">
              <p className="text-xs text-muted">
                Tampa quiet-weather demo — not official alerts for your home.
              </p>
              <ul className="space-y-3">
                {demoRecs.map((item) => (
                  <li key={item.id}>
                    <ActionCard action={item} onWhy={() => setWhy(item)} />
                  </li>
                ))}
              </ul>
            </div>
          ) : plan.recommendationsUnavailable && demoRecs?.length === 0 ? (
            <div className="mt-2">
              <UnavailableNote title="Tampa demo unavailable">
                GET /api/recommendations?fixture=tampa is not on this branch
                yet.
              </UnavailableNote>
            </div>
          ) : plan.loading && plan.recommendations.length === 0 ? (
            <p className="mt-2 text-sm text-muted">Loading actions…</p>
          ) : plan.recommendations.length === 0 ? (
            <Card className="mt-2" title="No actions returned">
              The plan service responded without recommended actions. That is
              not a fabricated checklist.
            </Card>
          ) : (
            <ul className="mt-2 space-y-3">
              {plan.recommendations.map((item) => (
                <li key={item.id}>
                  <ActionCard action={item} onWhy={() => setWhy(item)} />
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <Modal
        open={why !== null}
        title={why?.title ?? "Why this action"}
        onClose={() => setWhy(null)}
      >
        {why ? (
          <>
            {isKnown(why.rationale) ? <p>{why.rationale}</p> : null}
            {why.body ? <p className={isKnown(why.rationale) ? "mt-3" : ""}>{why.body}</p> : null}
            {!isKnown(why.rationale) && !why.body ? (
              <p>No additional explanation was provided by the plan service.</p>
            ) : null}
          </>
        ) : null}
      </Modal>
    </main>
  );
}

function AlertCard({
  alert,
  source,
  observedAt,
  allClear,
  locationLabel,
}: {
  alert: ActiveHazard | null;
  source: string | undefined;
  observedAt: string | null;
  allClear: boolean | "unknown";
  locationLabel: string;
}) {
  if (alert) {
    return (
      <Card eyebrow="Official alert" title={alert.headline}>
        <p className="text-foreground">
          {formatSeverity(alert.severity)}
          {isKnown(alert.urgency) ? ` · ${alert.urgency}` : ""}
        </p>
        <p className="mt-2 text-xs">
          Source: {sourceLabel(source, alert.provenance)} · {locationLabel}
        </p>
        <p className="mt-1 text-xs">
          Issued / updated {formatRelativeTime(observedAt ?? (isKnown(alert.onsetAt) ? alert.onsetAt : null))}
        </p>
      </Card>
    );
  }

  if (allClear === true) {
    return (
      <Card eyebrow="Official alert" title="No active official products">
        <p>
          An official check reported no active alerts for {locationLabel}.
        </p>
        <p className="mt-2 text-xs">
          Source: {sourceLabel(source)} · {formatRelativeTime(observedAt)}
        </p>
      </Card>
    );
  }

  return (
    <Card eyebrow="Official alert" title="Status not confirmed">
      <p>
        No official products are listed, and this is not an all-clear. StormReady
        will not guess.
      </p>
      <p className="mt-2 text-xs">
        Source: {sourceLabel(source)} · {formatRelativeTime(observedAt)}
      </p>
    </Card>
  );
}

function ConditionsRow({
  unavailable,
  hazards,
  allClear,
}: {
  unavailable: boolean;
  hazards: ActiveHazard[];
  allClear: boolean | "unknown";
}) {
  if (unavailable) {
    return (
      <Card eyebrow="Conditions" title="Not available">
        Compact conditions will appear when the alert service is connected.
      </Card>
    );
  }

  if (hazards.length === 0) {
    return (
      <Card eyebrow="Conditions" title={allClear === true ? "Quiet" : "Unconfirmed"}>
        {allClear === true
          ? "No active hazard products in the last official check."
          : "Conditions are not confirmed. An empty list is not treated as safe."}
      </Card>
    );
  }

  return (
    <Card eyebrow="Conditions" title="Active products">
      <ul className="flex flex-wrap gap-2">
        {hazards.slice(0, 6).map((hazard) => (
          <li
            key={hazard.id}
            className="rounded-full bg-surface-elevated px-3 py-1 text-xs font-medium text-foreground"
          >
            {formatSeverity(hazard.severity)} · {hazard.kind.replace(/_/g, " ")}
          </li>
        ))}
      </ul>
    </Card>
  );
}

function ActionCard({
  action,
  onWhy,
}: {
  action: RecommendationView;
  onWhy: () => void;
}) {
  const horizon = formatHorizon(action.timeframe, action.horizon);
  const reason = shortReason(action.rationale, action.body);
  const cost =
    action.costClass && isKnown(action.costClass) ? action.costClass : null;

  return (
    <Card>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-foreground">{action.title}</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <Badge tone={action.priority}>{formatPriority(action.priority)}</Badge>
            {horizon ? <Badge>{horizon}</Badge> : null}
            {cost ? <Badge>{formatCostClass(cost)}</Badge> : null}
          </div>
        </div>
        <button
          type="button"
          onClick={onWhy}
          className="shrink-0 text-sm font-semibold text-accent-strong"
        >
          Why?
        </button>
      </div>
      {reason ? <p className="mt-3 text-sm leading-relaxed text-muted">{reason}</p> : null}
    </Card>
  );
}

function Badge({
  children,
  tone,
}: {
  children: string;
  tone?: RecommendationView["priority"];
}) {
  const color =
    tone === "critical"
      ? "bg-danger/10 text-danger"
      : tone === "high"
        ? "bg-warning/10 text-warning"
        : "bg-surface-elevated text-foreground";
  return (
    <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${color}`}>
      {children}
    </span>
  );
}

function pickPrimaryAlert(hazards: ActiveHazard[]): ActiveHazard | null {
  if (hazards.length === 0) return null;
  return [...hazards].sort(
    (a, b) => SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity],
  )[0];
}

function summarizeAlert(
  plan: ReturnType<typeof usePlanData>,
  alert: ActiveHazard | null,
): string {
  if (plan.alertsUnavailable) return "Unavailable";
  if (plan.loading && !plan.alerts) return "Checking…";
  if (alert) return alert.headline;
  if (plan.alerts?.allClear === true) return "No active official products";
  return "Not confirmed";
}

function sourceLabel(source?: string, fallback?: string): string {
  const value = source ?? fallback;
  if (value === "external_source") return "Official / external source";
  if (value === "user_reported") return "User reported";
  return "Source not confirmed";
}
