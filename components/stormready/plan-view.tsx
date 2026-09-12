"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Modal } from "@/components/ui/modal";
import { ChoiceGroup } from "@/components/stormready/choice-field";
import { SavePlanControl } from "@/components/stormready/save-plan-control";
import { useCloudPlanSync } from "@/lib/auth/cloud-sync";
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
  hazardFixtureFor,
  isKnown,
  tampaDemoInput,
  type ActiveHazard,
  type BudgetClass,
  type Unknownable,
} from "@/lib/stormready";
import { hitFromRecommendation } from "@/lib/stress";
import { useProfile } from "@/lib/use-profile";
import {
  fetchRecommendations,
  fetchTampaDemo,
  type DemoScenario,
  type OptimizationView,
  type RecommendationView,
  type ResourceStatus,
} from "@/lib/stormready-api";
import { linksForCategory } from "@/lib/help/for-category";
import type { OfficialLink } from "@/lib/help/content";
import {
  COST_UNITS_BY_CLASS,
  diffOptimizationResults,
  labelForCostUnits,
  type OptimizationConstraints,
  type OptimizationDiff,
  type OptimizationResult,
  type TransportMode,
} from "@/lib/optimization";

const ALERT_UNAVAILABLE =
  "Alert service is not connected yet. StormReady will not invent warnings or mark this area all-clear.";
const ALERT_ERROR =
  "Official alerts could not be loaded. StormReady will not invent warnings or mark this area all-clear.";
const ACTION_UNAVAILABLE =
  "The plan service is not connected yet, or it failed closed because official alerts are unavailable. StormReady will not invent a live checklist.";
const ACTION_ERROR =
  "Recommended actions could not be loaded. StormReady will not invent a live checklist.";

const DEMO_SCENARIOS: { value: DemoScenario; label: string }[] = [
  { value: "quiet", label: "Quiet" },
  { value: "watch", label: "Watch" },
  { value: "warning", label: "Warning" },
  { value: "evac", label: "Evac" },
  { value: "flood", label: "Flood" },
];

type BudgetPreset = "zero" | "low" | "moderate" | "flexible" | "unconstrained";
type TimePreset = "15" | "30" | "60" | "180" | "unconstrained";

export function PlanView() {
  const { profile, hydrated } = useProfile();
  useCloudPlanSync();
  const plan = usePlanData(profile, hydrated);
  const [why, setWhy] = useState<RecommendationView | null>(null);
  const [ruleOpen, setRuleOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [prioritizeOpen, setPrioritizeOpen] = useState(false);
  const [mode, setMode] = useState<"live" | "demo">("live");
  const [scenario, setScenario] = useState<DemoScenario>("quiet");
  const [demoRecs, setDemoRecs] = useState<RecommendationView[] | null>(null);
  const [demoOptimization, setDemoOptimization] = useState<OptimizationView | null>(
    null,
  );
  const [demoHazards, setDemoHazards] = useState<ReturnType<typeof hazardFixtureFor> | null>(
    null,
  );
  const [demoStatus, setDemoStatus] = useState<ResourceStatus>("idle");
  const [sessionRecs, setSessionRecs] = useState<RecommendationView[] | null>(null);
  const [sessionOptimization, setSessionOptimization] =
    useState<OptimizationView | null>(null);
  const [planDelta, setPlanDelta] = useState<OptimizationDiff | null>(null);
  const [recalcStatus, setRecalcStatus] = useState<ResourceStatus>("idle");
  const [budgetPreset, setBudgetPreset] = useState<BudgetPreset>("low");
  const [timePreset, setTimePreset] = useState<TimePreset>("unconstrained");
  const [transport, setTransport] = useState<Exclude<TransportMode, "unknown">>("car");

  const householdBudget = profile.household?.budgetClass ?? "unknown";
  const isDemo = mode === "demo";
  const alerts = isDemo ? demoHazards : plan.alerts;
  const alertsStatus: ResourceStatus = isDemo
    ? demoStatus === "idle"
      ? "loading"
      : demoStatus
    : plan.alertsStatus;
  const baseRecs = isDemo ? (demoRecs ?? []) : plan.recommendations;
  const recommendations = sessionRecs ?? baseRecs;
  const optimization = sessionOptimization ?? (isDemo ? demoOptimization : plan.optimization);
  const recsStatus: ResourceStatus = isDemo
    ? demoStatus === "idle"
      ? "loading"
      : demoStatus
    : plan.recommendationsStatus;

  const primaryAlert = useMemo(
    () => pickPrimaryAlert(alerts?.hazards ?? []),
    [alerts],
  );
  const topAction = recommendations[0] ?? null;

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

  const lastUpdated =
    alerts?.observedAt ?? profile.updatedAt ?? profile.home?.updatedAt ?? null;

  async function applyDemo(nextScenario: DemoScenario) {
    setDemoStatus("loading");
    setSessionRecs(null);
    setSessionOptimization(null);
    setPlanDelta(null);
    const result = await fetchTampaDemo(nextScenario);
    if (result.ok) {
      setDemoRecs(result.data.recommendations.slice(0, 5));
      setDemoOptimization(result.data.optimization);
      setDemoHazards(hazardFixtureFor(nextScenario));
      setDemoStatus("ready");
      return;
    }
    setDemoRecs([]);
    setDemoOptimization(null);
    setDemoHazards(null);
    setDemoStatus(result.reason);
  }

  async function recalculate() {
    const constraints = overlayConstraints(budgetPreset, timePreset, transport);
    const liveInput = {
      home: profile.home,
      household: profile.household,
      hazards: plan.alerts,
      hazardSource:
        plan.alertsStatus === "ready"
          ? ("live" as const)
          : ("unavailable" as const),
      constraints,
    };
    const input = isDemo
      ? { ...tampaDemoInput(scenario), constraints }
      : liveInput;

    if (!isDemo && plan.alertsStatus !== "ready") {
      setRecalcStatus("unavailable");
      return;
    }

    setRecalcStatus("loading");
    const previous = optimizationAsResult(optimization);
    const result = await fetchRecommendations(input);
    if (!result.ok) {
      setRecalcStatus(result.reason);
      return;
    }
    setSessionRecs(result.data.recommendations.slice(0, 5));
    setSessionOptimization(result.data.optimization);
    const next = optimizationAsResult(result.data.optimization);
    if (previous && next) {
      setPlanDelta(diffOptimizationResults(previous, next));
    } else {
      setPlanDelta(null);
    }
    setRecalcStatus("ready");
    setPrioritizeOpen(false);
  }

  return (
    <main className="flex min-h-full flex-1 flex-col">
      <Header title="Your plan" />
      <div className="flex flex-1 flex-col gap-4 px-5 pb-8 pt-4">
        <ModeToggle
          mode={mode}
          scenario={scenario}
          onLive={() => {
            setMode("live");
            setSessionRecs(null);
            setSessionOptimization(null);
            setPlanDelta(null);
          }}
          onDemo={async (next) => {
            setMode("demo");
            setScenario(next);
            await applyDemo(next);
          }}
        />

        {isDemo ? (
          <p
            role="status"
            className="rounded-2xl border border-warning/40 bg-warning/10 px-3 py-2 text-xs leading-relaxed text-foreground"
          >
            DEMO — Tampa fixture, not live NWS. This is not official alerts for
            your home.
          </p>
        ) : null}

        <section>
          <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted">
            Home summary
          </p>
          <h2 className="mt-1 text-lg font-semibold text-foreground">
            {formatLocation(profile.home)}
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-muted">
            Current alert: {summarizeAlert(alertsStatus, alerts, primaryAlert)}
          </p>
          <p className="mt-1 text-sm leading-relaxed text-muted">
            Top action:{" "}
            {recsStatus === "unavailable" || recsStatus === "error"
              ? "Unavailable"
              : topAction
                ? topAction.title
                : recsStatus === "loading"
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
          <Link
            href={`/stress-test?hit=${hitFromRecommendation(
              topAction && isKnown(topAction.ruleId) ? topAction.ruleId : null,
            )}`}
            className="mt-2 block text-sm font-semibold text-accent-strong"
          >
            Test this house
          </Link>
        </section>

        <SavePlanControl
          snapshot={{
            home: profile.home,
            household: profile.household,
            hazards: alerts ?? null,
            recommendations,
          }}
          returnTo="/plan"
        />

        {!isDemo ? (
          <QueryState
            status={plan.alertsStatus}
            title="Official alerts"
            loadingLabel="Looking up products for your location."
            errorMessage={ALERT_ERROR}
            unavailableMessage={ALERT_UNAVAILABLE}
          />
        ) : null}
        {alertsStatus === "ready" ? (
          <AlertCard
            alert={primaryAlert}
            source={alerts?.provenance}
            observedAt={alerts?.observedAt ?? null}
            allClear={alerts?.allClear ?? "unknown"}
            locationLabel={
              alerts && isKnown(alerts.locationLabel)
                ? alerts.locationLabel
                : formatLocation(profile.home)
            }
          />
        ) : null}

        <ConditionsRow
          status={alertsStatus}
          hazards={alerts?.hazards ?? []}
          allClear={alerts?.allClear ?? "unknown"}
        />

        {recsStatus === "ready" && topAction ? (
          <TopPriorityCard
            action={topAction}
            ruleOpen={ruleOpen}
            onToggleRule={() => setRuleOpen((open) => !open)}
            onWhy={() => setWhy(topAction)}
          />
        ) : null}

        <div className="flex flex-col gap-2">
          <Button variant="secondary" onClick={() => setPrioritizeOpen(true)}>
            Help Me Prioritize
          </Button>
          {planDelta ? (
            <p
              role="status"
              className="rounded-2xl border border-accent/30 bg-surface-elevated px-3 py-2 text-xs leading-relaxed text-foreground"
            >
              <span className="font-semibold">PLAN UPDATED.</span> {planDelta.summary}
            </p>
          ) : null}
        </div>

        {optimization && recsStatus === "ready" ? (
          <WhyThisPlan optimization={optimization} onDetails={() => setDetailsOpen(true)} />
        ) : null}

        <section>
          <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted">
            Actions
          </p>
          {recsStatus === "ready" && recommendations.length > 0 ? (
            <p className="mt-1 text-xs leading-relaxed text-muted">
              Grouped by when to act. Order comes from the optimizer (official
              actions first). Cost badges are classes, not prices. Utility is
              not a safety score.
            </p>
          ) : null}
          {!isDemo &&
          plan.recommendationsStatus === "unavailable" &&
          demoStatus === "idle" ? (
            <div className="mt-2 space-y-3">
              <UnavailableNote title="Recommended actions">
                {ACTION_UNAVAILABLE}
              </UnavailableNote>
              <Button
                variant="secondary"
                onClick={() => {
                  setMode("demo");
                  void applyDemo("quiet");
                }}
              >
                View Tampa quiet demo
              </Button>
            </div>
          ) : !isDemo &&
            plan.recommendationsStatus === "error" &&
            demoStatus === "idle" ? (
            <div className="mt-2 space-y-3">
              <ErrorNote title="Recommended actions">{ACTION_ERROR}</ErrorNote>
              <Button
                variant="secondary"
                onClick={() => {
                  setMode("demo");
                  void applyDemo("quiet");
                }}
              >
                View Tampa quiet demo
              </Button>
            </div>
          ) : recsStatus === "loading" ? (
            <div className="mt-2">
              <LoadingCard
                title={isDemo ? "Tampa demo" : "Recommended actions"}
                label={isDemo ? "Loading Tampa demo…" : "Loading actions…"}
              />
            </div>
          ) : recsStatus === "error" || recsStatus === "unavailable" ? (
            <div className="mt-2">
              <QueryState
                status={recsStatus}
                title={isDemo ? "Tampa demo unavailable" : "Recommended actions"}
                loadingLabel="Loading…"
                errorMessage="The plan could not be loaded. StormReady will not invent a checklist."
                unavailableMessage={
                  isDemo
                    ? "GET /api/recommendations?fixture=tampa is not on this branch yet."
                    : ACTION_UNAVAILABLE
                }
              />
            </div>
          ) : recommendations.length === 0 ? (
            <Card className="mt-2" title="No actions returned">
              The plan service responded without recommended actions. That is
              not a fabricated checklist.
            </Card>
          ) : (
            <div className="mt-2 space-y-3">
              <ActionGroups
                actions={recommendations}
                budgetClass={householdBudget}
                onWhy={setWhy}
              />
              {optimization ? (
                <LeftOutActions optimization={optimization} />
              ) : null}
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
            {typeof why.utilityScore === "number" ? (
              <p className="mt-3 text-xs">
                Preparedness utility {why.utilityScore.toFixed(2)} — ranking
                weight only, not a safety score.
              </p>
            ) : null}
          </>
        ) : null}
      </Modal>

      <Modal
        open={detailsOpen}
        title="Optimization details"
        onClose={() => setDetailsOpen(false)}
      >
        {optimization ? (
          <div className="max-h-[60vh] space-y-3 overflow-y-auto">
            <p>
              Solver: {optimization.solver}. Objective: maximize preparedness
              utility (not a safety percentage).
            </p>
            <p>
              Selected: {optimization.selectedIds.join(", ") || "none"}
            </p>
            <p>
              Hard constraints:{" "}
              {optimization.hardConstraintIds.join(", ") || "none"}
            </p>
            <p className="text-xs font-semibold text-foreground">Selected</p>
            <ul className="space-y-1">
              {optimization.candidates
                .filter((candidate) => candidate.selected)
                .map((candidate) => (
                  <li key={candidate.id} className="text-xs">
                    {candidate.ruleId}
                    {candidate.hardConstraint ? " · hard" : ""}
                  </li>
                ))}
            </ul>
            <p className="text-xs font-semibold text-foreground">Left out</p>
            <ul className="space-y-1">
              {optimization.candidates
                .filter((candidate) => !candidate.selected)
                .map((candidate) => (
                  <li key={candidate.id} className="text-xs">
                    {candidate.ruleId}
                    {leftOutReason(optimization, candidate.id)
                      ? ` · ${leftOutReason(optimization, candidate.id)}`
                      : ""}
                  </li>
                ))}
            </ul>
          </div>
        ) : (
          <p>No optimizer output for this plan.</p>
        )}
      </Modal>

      <Modal
        open={prioritizeOpen}
        title="Help Me Prioritize"
        onClose={() => setPrioritizeOpen(false)}
      >
        <p className="mb-3 text-xs">
          Session only — does not change your saved profile or require Auth0.
        </p>
        <div className="max-h-[55vh] space-y-4 overflow-y-auto">
          <ChoiceGroup
            legend="Budget class (not a price)"
            hint="Discrete knapsack units: no-cost, low, moderate, or higher."
            value={budgetPreset}
            options={[
              { value: "zero", label: "No-cost" },
              { value: "low", label: "Low" },
              { value: "moderate", label: "Moderate" },
              { value: "flexible", label: "Higher" },
              { value: "unconstrained", label: "Unconstrained" },
            ]}
            onChange={setBudgetPreset}
          />
          <ChoiceGroup
            legend="Time"
            value={timePreset}
            options={[
              { value: "15", label: "15 min" },
              { value: "30", label: "30 min" },
              { value: "60", label: "60 min" },
              { value: "180", label: "3 hours" },
              { value: "unconstrained", label: "Unconstrained" },
            ]}
            onChange={setTimePreset}
          />
          <ChoiceGroup
            legend="Transport"
            value={transport}
            options={[
              { value: "car", label: "Car" },
              { value: "limited", label: "Limited" },
              { value: "none", label: "No car" },
            ]}
            onChange={setTransport}
          />
        </div>
        {recalcStatus === "unavailable" ? (
          <p className="mt-3 text-xs text-danger">
            Live alerts are unavailable, so StormReady will not invent a
            recalculated plan. Switch to Demo or wait for NWS.
          </p>
        ) : null}
        <div className="mt-4">
          <Button onClick={() => void recalculate()} disabled={recalcStatus === "loading"}>
            {recalcStatus === "loading" ? (
              <Spinner label="Recalculating…" />
            ) : (
              "Recalculate plan"
            )}
          </Button>
        </div>
      </Modal>
    </main>
  );
}

function ModeToggle({
  mode,
  scenario,
  onLive,
  onDemo,
}: {
  mode: "live" | "demo";
  scenario: DemoScenario;
  onLive: () => void;
  onDemo: (scenario: DemoScenario) => void;
}) {
  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <button
          type="button"
          aria-pressed={mode === "live"}
          onClick={onLive}
          className={`h-11 flex-1 rounded-2xl border text-sm font-semibold ${
            mode === "live"
              ? "border-accent-strong bg-accent-strong text-white"
              : "border-border bg-white text-foreground"
          }`}
        >
          LIVE
        </button>
        <button
          type="button"
          aria-pressed={mode === "demo"}
          onClick={() => onDemo(scenario)}
          className={`h-11 flex-1 rounded-2xl border text-sm font-semibold ${
            mode === "demo"
              ? "border-accent-strong bg-accent-strong text-white"
              : "border-border bg-white text-foreground"
          }`}
        >
          DEMO
        </button>
      </div>
      {mode === "demo" ? (
        <div className="flex flex-wrap gap-1.5">
          {DEMO_SCENARIOS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => onDemo(option.value)}
              className={`rounded-full px-3 py-1 text-xs font-semibold ${
                scenario === option.value
                  ? "bg-accent-strong text-white"
                  : "bg-surface-elevated text-foreground"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      ) : (
        <p className="text-[11px] text-muted">Current NWS path for your saved location.</p>
      )}
    </div>
  );
}

function TopPriorityCard({
  action,
  ruleOpen,
  onToggleRule,
  onWhy,
}: {
  action: RecommendationView;
  ruleOpen: boolean;
  onToggleRule: () => void;
  onWhy: () => void;
}) {
  const cost = asBudgetClass(action.costClass);
  return (
    <Card eyebrow="Your Top Priority" title={action.title}>
      <p className="text-foreground">{shortReason(action.rationale, action.body)}</p>
      <p className="mt-2 text-xs">
        Source: {sourceLabel(action.provenance)}
        {action.official ? " · Official product" : ""}
      </p>
      <p className="mt-1 text-xs">
        {cost ? `Cost class: ${formatCostClass(cost)}` : "Cost class: not listed"}
        {typeof action.estimatedTimeMinutes === "number"
          ? ` · About ${action.estimatedTimeMinutes} planning minutes`
          : ""}
      </p>
      <p className="mt-1 text-xs">
        Utility is a ranking weight for this checklist, not a safety score.
      </p>
      <div className="mt-3 flex gap-3">
        <button
          type="button"
          onClick={onWhy}
          className="text-sm font-semibold text-accent-strong"
        >
          Why?
        </button>
        <button
          type="button"
          onClick={onToggleRule}
          className="text-sm font-semibold text-accent-strong"
        >
          {ruleOpen ? "Hide rule id" : "Show rule id"}
        </button>
      </div>
      {ruleOpen && isKnown(action.ruleId) ? (
        <p className="mt-2 font-mono text-xs text-foreground">{action.ruleId}</p>
      ) : null}
    </Card>
  );
}

function WhyThisPlan({
  optimization,
  onDetails,
}: {
  optimization: OptimizationView;
  onDetails: () => void;
}) {
  const used = optimization.constraintsUsed;
  const units = used.budgetUnits ?? used.budgetDollars ?? null;
  return (
    <Card eyebrow="Why this plan?" title="Constraints used">
      <p>
        Cost class: {labelForCostUnits(units)}
        {" · "}
        Time:{" "}
        {used.availableTimeMinutes === null
          ? "unconstrained"
          : `${used.availableTimeMinutes} min`}
        {" · "}
        Transport: {used.transport}
      </p>
      <p className="mt-2">
        {optimization.hardCount} official/hard · {optimization.discretionaryCount}{" "}
        discretionary · {optimization.planningCostUnits ?? optimization.planningCostDollars}{" "}
        cost units · {optimization.planningMinutes} min
      </p>
      {optimization.shortfall ? (
        <p className="mt-2 text-xs text-foreground">{optimization.shortfall}</p>
      ) : null}
      <p className="mt-2 text-xs">
        Cost classes are ranking units, not prices. Preparedness utility is not
        a safety or survival score.
      </p>
      <button
        type="button"
        onClick={onDetails}
        className="mt-3 text-sm font-semibold text-accent-strong"
      >
        View optimization details
      </button>
    </Card>
  );
}

function overlayConstraints(
  budgetPreset: BudgetPreset,
  timePreset: TimePreset,
  transport: Exclude<TransportMode, "unknown">,
): OptimizationConstraints {
  const budgetUnits =
    budgetPreset === "unconstrained" ? null : COST_UNITS_BY_CLASS[budgetPreset];
  return {
    budgetUnits,
    budgetDollars: budgetUnits,
    availableTimeMinutes:
      timePreset === "unconstrained" ? null : Number(timePreset),
    transport,
  };
}

function leftOutReason(optimization: OptimizationView, id: string): string | null {
  const rejected = optimization.rejected.find((item) => item.id === id);
  if (!rejected || rejected.reasons.length === 0) return "Not in the 3–5 selected set";
  return rejected.reasons.map(humanRejection).join("; ");
}

function humanRejection(reason: string): string {
  switch (reason) {
    case "over_budget":
      return "Above this cost class";
    case "over_time":
      return "Needs more time than available";
    case "excluded_transport":
      return "Needs a car";
    case "skipped_backup_power":
      return "Backup power already on the profile";
    case "over_surface_limit":
      return "Plan already has 5 actions";
    default:
      return "Not in the 3–5 selected set";
  }
}

function LeftOutActions({ optimization }: { optimization: OptimizationView }) {
  const leftOut = optimization.candidates.filter((candidate) => !candidate.selected);
  if (leftOut.length === 0) return null;
  return (
    <Card eyebrow="Not selected this round" title="Left-out actions">
      <p className="mb-2 text-xs">
        Matched rules that did not fit remaining cost-class, time, transport, or
        the 3–5 action cap. Official / evacuate actions stay in the selected set.
      </p>
      <ul className="space-y-2">
        {leftOut.map((candidate) => (
          <li key={candidate.id} className="text-sm leading-snug text-foreground">
            {candidate.title}
            <span className="block text-xs text-muted">
              {candidate.ruleId} · {leftOutReason(optimization, candidate.id)}
            </span>
            <ActionOfficialLinks links={linksForCategory(candidate.category)} />
          </li>
        ))}
      </ul>
    </Card>
  );
}

function optimizationAsResult(
  view: OptimizationView | null,
): OptimizationResult | null {
  if (!view) return null;
  const units =
    view.constraintsUsed.budgetUnits ?? view.constraintsUsed.budgetDollars ?? null;
  return {
    solver: "knapsack_dp",
    objective: "maximize_preparedness_utility",
    selected: [],
    selectedIds: view.selectedIds,
    rejected: view.rejected.map((item) => ({
      id: item.id,
      ruleId: item.ruleId,
      reasons: item.reasons as OptimizationResult["rejected"][number]["reasons"],
    })),
    candidates: view.candidates,
    hardConstraintIds: view.hardConstraintIds,
    constraintsUsed: {
      ...view.constraintsUsed,
      budgetUnits: units,
      budgetDollars: units,
    },
    planningCostUnits: view.planningCostUnits ?? view.planningCostDollars,
    planningCostDollars: view.planningCostUnits ?? view.planningCostDollars,
    planningMinutes: view.planningMinutes,
    hardCount: view.hardCount,
    discretionaryCount: view.discretionaryCount,
    notes: view.notes,
    shortfall: view.shortfall,
  };
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
            {action.hardConstraint || action.official ? "Hard constraint" : "Optimizer"}{" "}
            {rank}
            {cost ? ` · ${formatCostClass(cost)}` : ""}
            {typeof action.estimatedTimeMinutes === "number"
              ? ` · ${action.estimatedTimeMinutes} min`
              : ""}
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
            {action.official ? <Badge tone="critical">Official</Badge> : null}
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
      <ActionOfficialLinks links={linksForCategory(action.category)} />
    </Card>
  );
}

function ActionOfficialLinks({ links }: { links: OfficialLink[] }) {
  const shown = links.slice(0, 2);
  if (shown.length === 0) return null;

  return (
    <div className="mt-3">
      <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted">
        Get local help
      </p>
      <ul className="mt-1 space-y-1">
        {shown.map((link) => (
          <li key={link.id} className="text-sm leading-snug">
            <a
              href={link.href}
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-accent-strong underline-offset-2 hover:underline"
            >
              {link.title}
            </a>
            <span className="ml-1 text-[11px] text-muted">
              Source: {link.source}
            </span>
          </li>
        ))}
      </ul>
    </div>
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
  status: ResourceStatus,
  alerts: { allClear?: boolean | "unknown"; hazards?: ActiveHazard[] } | null | undefined,
  alert: ActiveHazard | null,
): string {
  if (status === "unavailable" || status === "error") return "Unavailable";
  if (status === "loading") return "Checking…";
  if (alert) return alert.headline;
  if (alerts?.allClear === true) return "No active official products";
  return "Not confirmed";
}

function sourceLabel(source?: string, fallback?: string): string {
  const value = source ?? fallback;
  if (value === "external_source") return "Official / external source";
  if (value === "user_reported") return "User reported";
  return "Source not confirmed";
}
