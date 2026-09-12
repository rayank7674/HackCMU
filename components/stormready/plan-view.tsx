"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Modal } from "@/components/ui/modal";
import { SavePlanControl } from "@/components/stormready/save-plan-control";
import { usePlanData } from "@/components/stormready/plan-data";
import {
  ErrorNote,
  LoadingCard,
  QueryState,
  Spinner,
} from "@/components/stormready/query-state";
import { UnavailableNote } from "@/components/stormready/unavailable-note";
import {
  SEVERITY_RANK,
  arrangePlanActions,
  asBudgetClass,
  budgetFitLabel,
  formatCostClass,
  formatLocation,
  formatPriority,
  formatRelativeTime,
  formatSeverity,
  shortReason,
} from "@/lib/stormready-format";
import {
  isKnown,
  type ActiveHazard,
  type BudgetClass,
  type Unknownable,
} from "@/lib/stormready";
import { useProfile } from "@/lib/use-profile";
import {
  fetchTampaDemo,
  type RecommendationView,
  type ResourceStatus,
} from "@/lib/stormready-api";

const ALERT_UNAVAILABLE =
  "Alert service is not connected yet. StormReady will not invent warnings or mark this area all-clear.";
const ALERT_ERROR =
  "Official alerts could not be loaded. StormReady will not invent warnings or mark this area all-clear.";
const ACTION_UNAVAILABLE =
  "The plan service is not connected yet, or it failed closed because official alerts are unavailable. StormReady will not invent a live checklist.";
const ACTION_ERROR =
  "Recommended actions could not be loaded. StormReady will not invent a live checklist.";

export function PlanView() {
  const { profile, hydrated } = useProfile();
  const plan = usePlanData(profile, hydrated);
  const [why, setWhy] = useState<RecommendationView | null>(null);
  const [demoRecs, setDemoRecs] = useState<RecommendationView[] | null>(null);
  const [demoStatus, setDemoStatus] = useState<ResourceStatus>("idle");

  const householdBudget = profile.household?.budgetClass ?? "unknown";
  const primaryAlert = useMemo(
    () => pickPrimaryAlert(plan.alerts?.hazards ?? []),
    [plan.alerts],
  );

  if (!hydrated) {
    return (
      <main className="flex flex-1 flex-col">
        <Header title="Your plan" />
        <div className="px-5 py-8">
          <LoadingCard title="Your home" label="Loading your home…" lines={2} />
        </div>
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

  const arranged = arrangePlanActions(plan.recommendations, householdBudget);
  const topAction = arranged[0]?.items[0] ?? plan.recommendations[0] ?? null;
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
            {plan.recommendationsStatus === "unavailable" ||
            plan.recommendationsStatus === "error"
              ? "Unavailable"
              : topAction
                ? topAction.title
                : plan.recommendationsStatus === "loading"
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

        <SavePlanControl
          snapshot={{
            home: profile.home,
            household: profile.household,
            hazards: plan.alerts,
            recommendations: plan.recommendations,
          }}
        />

        <QueryState
          status={plan.alertsStatus}
          title="Official alerts"
          loadingLabel="Looking up products for your location."
          errorMessage={ALERT_ERROR}
          unavailableMessage={ALERT_UNAVAILABLE}
        />
        {plan.alertsStatus === "ready" ? (
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
        ) : null}

        <ConditionsRow
          status={plan.alertsStatus}
          hazards={plan.alerts?.hazards ?? []}
          allClear={plan.alerts?.allClear ?? "unknown"}
        />

        <section>
          <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted">
            Actions
          </p>
          {plan.recommendationsStatus === "ready" &&
          plan.recommendations.length > 0 ? (
            <p className="mt-1 text-xs leading-relaxed text-muted">
              Grouped by when to act. Ranked no-cost first
              {isKnown(householdBudget)
                ? `, then what fits a ${formatCostClass(householdBudget).toLowerCase()} budget`
                : ""}
              . Badges are cost classes, not prices.
            </p>
          ) : null}
          {plan.recommendationsStatus === "unavailable" &&
          demoStatus === "idle" ? (
            <div className="mt-2 space-y-3">
              <UnavailableNote title="Recommended actions">
                {ACTION_UNAVAILABLE}
              </UnavailableNote>
              <TampaDemoButton
                busy={false}
                onClick={() => loadTampaDemo(setDemoRecs, setDemoStatus)}
              />
            </div>
          ) : plan.recommendationsStatus === "error" && demoStatus === "idle" ? (
            <div className="mt-2 space-y-3">
              <ErrorNote title="Recommended actions">{ACTION_ERROR}</ErrorNote>
              <TampaDemoButton
                busy={false}
                onClick={() => loadTampaDemo(setDemoRecs, setDemoStatus)}
              />
            </div>
          ) : demoStatus === "loading" ? (
            <div className="mt-2">
              <LoadingCard
                title="Tampa quiet demo"
                label="Loading Tampa demo…"
              />
            </div>
          ) : demoStatus === "ready" && demoRecs && demoRecs.length > 0 ? (
            <div className="mt-2 space-y-3">
              <p className="text-xs text-muted">
                Tampa quiet-weather demo — not official alerts for your home.
              </p>
              <ActionGroups
                actions={demoRecs}
                budgetClass={householdBudget}
                onWhy={setWhy}
              />
            </div>
          ) : demoStatus === "error" ||
            (demoStatus === "ready" && demoRecs?.length === 0) ||
            demoStatus === "unavailable" ? (
            <div className="mt-2">
              <QueryState
                status={demoStatus === "ready" ? "unavailable" : demoStatus}
                title="Tampa demo unavailable"
                loadingLabel="Loading Tampa demo…"
                errorMessage="The Tampa demo could not be loaded. StormReady will not invent a checklist."
                unavailableMessage="GET /api/recommendations?fixture=tampa is not on this branch yet."
              />
            </div>
          ) : plan.recommendationsStatus === "loading" ? (
            <div className="mt-2">
              <LoadingCard title="Recommended actions" label="Loading actions…" />
            </div>
          ) : plan.recommendations.length === 0 ? (
            <Card className="mt-2" title="No actions returned">
              The plan service responded without recommended actions. That is
              not a fabricated checklist.
            </Card>
          ) : (
            <div className="mt-2">
              <ActionGroups
                actions={plan.recommendations}
                budgetClass={householdBudget}
                onWhy={setWhy}
              />
            </div>
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
            {why.body ? (
              <p className={isKnown(why.rationale) ? "mt-3" : ""}>{why.body}</p>
            ) : null}
            {!isKnown(why.rationale) && !why.body ? (
              <p>No additional explanation was provided by the plan service.</p>
            ) : null}
          </>
        ) : null}
      </Modal>
    </main>
  );
}

function ActionGroups({
  actions,
  budgetClass,
  onWhy,
}: {
  actions: RecommendationView[];
  budgetClass: Unknownable<BudgetClass>;
  onWhy: (action: RecommendationView) => void;
}) {
  const groups = arrangePlanActions(actions, budgetClass);
  return (
    <div className="space-y-5">
      {groups.map((group) => (
        <section key={group.horizon} aria-labelledby={`horizon-${group.horizon}`}>
          <h3
            id={`horizon-${group.horizon}`}
            className="text-sm font-semibold text-foreground"
          >
            {group.label}
          </h3>
          <p className="mt-0.5 text-[11px] uppercase tracking-[0.14em] text-muted">
            {group.horizon === "now"
              ? "Do these first"
              : group.horizon === "before_next_event"
                ? "Prep before the next storm"
                : "When you can"}
          </p>
          <ul className="mt-2 space-y-3">
            {group.items.map((item, index) => (
              <li key={item.id}>
                <ActionCard
                  action={item}
                  rank={index + 1}
                  budgetClass={budgetClass}
                  onWhy={() => onWhy(item)}
                />
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

function TampaDemoButton({
  busy,
  onClick,
}: {
  busy: boolean;
  onClick: () => void;
}) {
  return (
    <Button variant="secondary" disabled={busy} onClick={onClick}>
      {busy ? <Spinner label="Loading Tampa demo…" /> : "View Tampa quiet demo"}
    </Button>
  );
}

async function loadTampaDemo(
  setDemoRecs: (recs: RecommendationView[] | null) => void,
  setDemoStatus: (status: ResourceStatus) => void,
) {
  setDemoStatus("loading");
  const result = await fetchTampaDemo("quiet");
  if (result.ok) {
    setDemoRecs(result.data.slice(0, 5));
    setDemoStatus("ready");
    return;
  }
  setDemoRecs([]);
  setDemoStatus(result.reason);
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
          Issued / updated{" "}
          {formatRelativeTime(
            observedAt ?? (isKnown(alert.onsetAt) ? alert.onsetAt : null),
          )}
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
  status,
  hazards,
  allClear,
}: {
  status: ResourceStatus;
  hazards: ActiveHazard[];
  allClear: boolean | "unknown";
}) {
  if (status === "loading") {
    return <LoadingCard title="Conditions" label="Checking conditions…" lines={2} />;
  }
  if (status === "error") {
    return (
      <ErrorNote title="Conditions">
        Compact conditions will appear when official alerts load. An empty list
        is not treated as safe.
      </ErrorNote>
    );
  }
  if (status === "unavailable") {
    return (
      <UnavailableNote title="Conditions">
        Compact conditions will appear when the alert service is connected.
      </UnavailableNote>
    );
  }

  if (hazards.length === 0) {
    return (
      <Card
        eyebrow="Conditions"
        title={allClear === true ? "Quiet" : "Unconfirmed"}
      >
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
  rank,
  budgetClass,
  onWhy,
}: {
  action: RecommendationView;
  rank: number;
  budgetClass: Unknownable<BudgetClass>;
  onWhy: () => void;
}) {
  const reason = shortReason(action.rationale, action.body);
  const cost = asBudgetClass(action.costClass);
  const fit = budgetFitLabel(action.costClass, budgetClass);
  const rankBar = cost
    ? cost === "zero"
      ? "border-l-4 border-l-accent-strong"
      : cost === "low"
        ? "border-l-4 border-l-accent"
        : cost === "moderate"
          ? "border-l-4 border-l-warning"
          : "border-l-4 border-l-border"
    : "border-l-4 border-l-border";

  return (
    <Card className={rankBar}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted">
            Budget rank {rank}
            {cost ? ` · ${formatCostClass(cost)}` : ""}
          </p>
          <p className="mt-1 text-sm font-semibold text-foreground">
            {action.title}
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <Badge tone={action.priority}>{formatPriority(action.priority)}</Badge>
            {cost ? <Badge>{formatCostClass(cost)}</Badge> : null}
            {fit ? (
              <Badge tone={fit === "Above budget" ? "high" : undefined}>
                {fit}
              </Badge>
            ) : null}
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
      {reason ? (
        <p className="mt-3 text-sm leading-relaxed text-muted">{reason}</p>
      ) : null}
    </Card>
  );
}

function Badge({
  children,
  tone,
}: {
  children: string;
  tone?: RecommendationView["priority"] | "high";
}) {
  const color =
    tone === "critical"
      ? "bg-danger/10 text-danger"
      : tone === "high"
        ? "bg-warning/10 text-warning"
        : "bg-surface-elevated text-foreground";
  return (
    <span
      className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${color}`}
    >
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
  if (plan.alertsStatus === "unavailable" || plan.alertsStatus === "error") {
    return "Unavailable";
  }
  if (plan.alertsStatus === "loading") return "Checking…";
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

