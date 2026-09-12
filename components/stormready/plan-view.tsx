"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Modal } from "@/components/ui/modal";
import { ChoiceGroup } from "@/components/stormready/choice-field";
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
  formatCostClass,
  formatLocation,
  formatRelativeTime,
  formatSeverity,
  resolvePlanHorizon,
} from "@/lib/stormready-format";
import {
  checklistActions as pickChecklistActions,
  importanceFromAction,
  type ImportanceTone,
} from "@/lib/plan-checklist";
import {
  hazardFixtureFor,
  isKnown,
  tampaDemoInput,
  type ActiveHazard,
  type BudgetClass,
  type HomeProfile,
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
import { PREPAREDNESS_LINKS } from "@/lib/help/content";
import { regionalRisksForHome } from "@/lib/regional-risks";
import {
  milesFromHome,
  reinforcementGuide,
} from "@/lib/map/reinforcements";
import { seasonFromHome } from "@/lib/integrations/season";
import {
  COST_UNITS_BY_CLASS,
  diffOptimizationResults,
  type OptimizationConstraints,
  type OptimizationDiff,
  type OptimizationResult,
  type TransportMode,
} from "@/lib/optimization";

const ALERT_UNAVAILABLE =
  "We could not reach the alert service yet. StormReady will not invent a warning or say the area is clear.";
const ALERT_ERROR =
  "Official alerts could not be loaded. StormReady will not invent a warning or say the area is clear.";
const ACTION_UNAVAILABLE =
  "Your checklist is not available yet, often because alerts could not be confirmed. StormReady will not invent steps.";
const ACTION_ERROR =
  "Your checklist could not be loaded. StormReady will not invent steps.";

const DEMO_SCENARIOS: { value: DemoScenario; label: string }[] = [
  { value: "quiet", label: "Quiet" },
  { value: "watch", label: "Watch" },
  { value: "warning", label: "Warning" },
  { value: "evac", label: "Evac" },
  { value: "flood", label: "Flood" },
];

type BudgetPreset = "zero" | "low" | "moderate" | "flexible" | "unconstrained";
type TimePreset = "15" | "30" | "60" | "180" | "unconstrained";

const CHECKLIST_STORAGE_KEY = "stormready:plan-checklist:v1";

export function PlanView() {
  const { profile, hydrated } = useProfile();
  useCloudPlanSync();
  const plan = usePlanData(profile, hydrated);
  const [why, setWhy] = useState<RecommendationView | null>(null);
  const [checkedSteps, setCheckedSteps] = useState<Record<string, boolean>>({});
  const [prioritizeOpen, setPrioritizeOpen] = useState(false);
  const [placesOpen, setPlacesOpen] = useState(false);
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

  const checklistScope = `${profile.home?.id ?? ""}|${isDemo ? `demo:${scenario}` : "live"}`;

  useEffect(() => {
    if (!hydrated) return;
    try {
      const raw = window.sessionStorage.getItem(CHECKLIST_STORAGE_KEY);
      if (!raw) {
        setCheckedSteps({});
        return;
      }
      const parsed = JSON.parse(raw) as { scope?: string; checked?: Record<string, boolean> };
      if (parsed.scope === checklistScope && parsed.checked) {
        setCheckedSteps(parsed.checked);
      } else {
        setCheckedSteps({});
      }
    } catch {
      setCheckedSteps({});
    }
  }, [hydrated, checklistScope]);

  useEffect(() => {
    if (!hydrated) return;
    try {
      window.sessionStorage.setItem(
        CHECKLIST_STORAGE_KEY,
        JSON.stringify({ scope: checklistScope, checked: checkedSteps }),
      );
    } catch {
      /* ignore quota / private mode */
    }
  }, [hydrated, checklistScope, checkedSteps]);

  function toggleStep(id: string) {
    setCheckedSteps((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  if (!hydrated) {
    return (
      <main className="flex flex-1 flex-col bg-background">
        <div className="px-5 py-8">
          <LoadingCard title="Your home" label="Loading your home…" lines={2} />
        </div>
      </main>
    );
  }

  if (!profile.home && !profile.household) {
    return (
      <main className="flex flex-1 flex-col bg-background">
        <div className="flex flex-1 flex-col px-5 pb-8 pt-6">
          <h2 className="text-2xl font-semibold tracking-tight text-foreground">
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
  const locationLabel =
    alerts && isKnown(alerts.locationLabel)
      ? alerts.locationLabel
      : formatLocation(profile.home);
  const homeTitle = planHomeTitle(profile.home);
  const homeMeta = planHomeMeta(profile.home);
  const checklistActions = pickChecklistActions(recommendations, 3);
  const stepOne = checklistActions[0];
  const checklistDone = checklistActions.filter((action) =>
    Boolean(checkedSteps[action.id]),
  ).length;
  const checklistPercent =
    checklistActions.length > 0
      ? Math.round((checklistDone / checklistActions.length) * 100)
      : 0;
  const regionalRisks = regionalRisksForHome(profile.home);
  const season = seasonFromHome(profile.home);
  const supplies = reinforcementGuide(profile.home);

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
    <main className="flex min-h-full flex-1 flex-col bg-blue-wash">
      <section className="sr-hero-banner bg-blue-deep px-5 pb-6 pt-6 text-white">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h2 className="text-3xl font-semibold tracking-tight">{homeTitle}</h2>
            {homeMeta ? (
              <p className="mt-1 text-sm text-blue-pale">{homeMeta}</p>
            ) : null}
            {season.applicable ? (
              <p className="mt-2.5 inline-flex w-fit rounded-full bg-white/15 px-3 py-1 text-xs font-semibold text-white">
                {season.label}
              </p>
            ) : null}
            <p className="mt-2 text-xs leading-relaxed text-blue-pale">
              {season.sourceNote}
            </p>
            <p className="mt-2 text-[11px] font-medium uppercase tracking-[0.16em] text-blue-pale">
              {recsStatus === "ready" && checklistActions.length > 0
                ? `Checklist ${checklistPercent}% · ${formatRelativeTime(lastUpdated)}`
                : `Updated ${formatRelativeTime(lastUpdated)}`}
            </p>
          </div>
          <Link
            href="/onboarding"
            className="shrink-0 rounded-xl bg-white/15 px-3 py-2 text-sm font-semibold text-white hover:bg-white/25"
          >
            Update home details
          </Link>
        </div>
      </section>

      <div className="flex min-w-0 flex-1 flex-col gap-4 bg-blue-wash px-5 pb-8 pt-4">
        {isDemo ? (
          <p
            role="status"
            className="rounded-2xl border border-warning/40 bg-warning/10 px-3 py-2 text-xs leading-relaxed text-foreground"
          >
            Demo mode uses sample Tampa weather, not live alerts for your home.
          </p>
        ) : null}

        {/* Flow: Situation first */}
        <SituationStrip
          status={alertsStatus}
          alert={primaryAlert}
          hazards={alerts?.hazards ?? []}
          allClear={alerts?.allClear ?? "unknown"}
          locationLabel={locationLabel}
          source={alerts?.provenance}
          isDemo={isDemo}
          liveAlertsStatus={plan.alertsStatus}
        />

        {/* Completion bar + checklist (screenshot 1) */}
        <section className="rounded-3xl border border-border bg-white p-4 shadow-[0_10px_28px_rgba(13,31,60,0.06)]">
          {recsStatus === "ready" && checklistActions.length > 0 ? (
            <div className="mb-4">
              <div className="flex items-end justify-between gap-3">
                <p className="text-sm font-semibold text-navy">Plan progress</p>
                <p className="text-sm font-semibold text-navy">{checklistPercent}%</p>
              </div>
              <div
                className="mt-2 h-3 w-full overflow-hidden rounded-full bg-blue-pale"
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={checklistPercent}
                aria-label="Checklist completion"
              >
                <div
                  className="h-full rounded-full bg-blue-deep transition-[width] duration-300 ease-out"
                  style={{ width: `${checklistPercent}%` }}
                />
              </div>
              <p className="mt-2 text-xs text-muted">
                {checklistDone} of {checklistActions.length} steps done
              </p>
            </div>
          ) : null}

          <div className="mb-3 flex items-center gap-3" role="separator" aria-label="Your checklist">
            <div className="h-px flex-1 bg-blue-pale" />
            <p className="shrink-0 text-[11px] font-semibold uppercase tracking-[0.2em] text-blue-deep">
              Your checklist
            </p>
            <div className="h-px flex-1 bg-blue-pale" />
          </div>

          {recsStatus === "ready" && checklistActions.length > 0 ? (
            <p className="text-sm leading-relaxed text-muted">
              Do these in order. Check each box when you finish. Tap{" "}
              <span className="font-semibold text-foreground">Why?</span> for
              the reason.
            </p>
          ) : null}

          {!isDemo &&
          plan.recommendationsStatus === "unavailable" &&
          demoStatus === "idle" ? (
            <div className="mt-3 space-y-3">
              <UnavailableNote title="Checklist unavailable">
                {ACTION_UNAVAILABLE}
              </UnavailableNote>
              <Button
                variant="secondary"
                onClick={() => {
                  setMode("demo");
                  void applyDemo("quiet");
                }}
              >
                Try the Tampa demo
              </Button>
            </div>
          ) : !isDemo &&
            plan.recommendationsStatus === "error" &&
            demoStatus === "idle" ? (
            <div className="mt-3 space-y-3">
              <ErrorNote title="Checklist unavailable">{ACTION_ERROR}</ErrorNote>
              <Button
                variant="secondary"
                onClick={() => {
                  setMode("demo");
                  void applyDemo("quiet");
                }}
              >
                Try the Tampa demo
              </Button>
            </div>
          ) : recsStatus === "loading" ? (
            <div className="mt-3">
              <LoadingCard
                title="Your checklist"
                label={isDemo ? "Loading Tampa demo…" : "Building your steps…"}
              />
            </div>
          ) : recsStatus === "error" || recsStatus === "unavailable" ? (
            <div className="mt-3">
              <QueryState
                status={recsStatus}
                title={isDemo ? "Demo unavailable" : "Checklist unavailable"}
                loadingLabel="Loading…"
                errorMessage="Your checklist could not be loaded. StormReady will not invent steps."
                unavailableMessage={
                  isDemo
                    ? "The Tampa demo is not available on this deployment yet."
                    : ACTION_UNAVAILABLE
                }
              />
            </div>
          ) : recommendations.length === 0 ? (
            <Card className="mt-3" title="No steps yet">
              Nothing came back for this checklist. That is not a made-up plan.
            </Card>
          ) : (
            <ol className="mt-4 space-y-3">
              {checklistActions.map((action, index) => (
                <li key={action.id}>
                  <ActionCard
                    action={action}
                    rank={index + 1}
                    budgetClass={householdBudget}
                    dueBy={dueByLabel(action, primaryAlert, alertsStatus)}
                    checked={Boolean(checkedSteps[action.id])}
                    onToggle={() => toggleStep(action.id)}
                    onWhy={() => setWhy(action)}
                  />
                </li>
              ))}
            </ol>
          )}

          {supplies.needs.length > 0 ? (
            <div className="mt-4 overflow-hidden rounded-2xl border border-blue-sky/70 bg-blue-pale/50">
              <div className="border-l-4 border-l-blue-deep px-3.5 py-3">
                <p className="text-sm font-semibold text-blue-deep">
                  Supplies for this house
                </p>
                <p className="mt-1 text-sm leading-relaxed text-navy">
                  {supplies.needs.map((need) => need.label).join(", ")} may be
                  needed here. These are nearby stores that sell the materials,
                  not a StormReady ranking or a hired contractor.
                </p>
                <Button
                  className="mt-3 bg-blue-deep text-white hover:bg-blue-mid"
                  onClick={() => setPlacesOpen(true)}
                >
                  Where can I get these
                </Button>
              </div>
            </div>
          ) : null}
        </section>

        <FuturePrepSection
          risks={regionalRisks}
          checkedSteps={checkedSteps}
          onToggle={toggleStep}
        />

        <section className="space-y-2">
          <Button variant="secondary" onClick={() => setPrioritizeOpen(true)}>
            Adjust for my time &amp; budget
          </Button>
          <Link
            href={`/stress-test?hit=${hitFromRecommendation(
              stepOne && isKnown(stepOne.ruleId) ? stepOne.ruleId : null,
            )}`}
            className="block text-sm font-semibold text-accent-strong"
          >
            Test this house
          </Link>
          {planDelta ? (
            <p
              role="status"
              className="rounded-2xl border border-accent/30 bg-surface-elevated px-3 py-2 text-xs leading-relaxed text-foreground"
            >
              <span className="font-semibold text-accent-strong">Updated.</span>{" "}
              {planDelta.summary}
            </p>
          ) : null}
        </section>
      </div>

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

      <Modal
        open={why !== null}
        title={why ? `Why: ${why.title}` : "Why this step"}
        hideTitle
        panelClassName="bg-blue-wash"
        onClose={() => setWhy(null)}
      >
        {why ? (
          <WhyActionPanel action={why} />
        ) : null}
      </Modal>

      <Modal
        open={placesOpen}
        title="Where to get these"
        onClose={() => setPlacesOpen(false)}
      >
        <p className="text-sm leading-relaxed text-foreground">
          Public listings with customer ratings. StormReady does not verify
          shops, prices, or workmanship.
        </p>
        {supplies.areaLabel ? (
          <p className="mt-2 text-xs font-semibold uppercase tracking-[0.14em] text-muted">
            {supplies.areaLabel}
          </p>
        ) : (
          <p className="mt-2 text-sm text-muted">
            No store list is stored for this city. Use the search link below
            instead of a made-up shop.
          </p>
        )}
        {supplies.places.length > 0 ? (
          <ul className="mt-3 space-y-3">
            {supplies.places.map((place) => {
              const miles = milesFromHome(profile.home, place);
              return (
                <li
                  key={place.id}
                  className="rounded-2xl border border-blue-pale bg-blue-wash px-3 py-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-blue-deep">{place.name}</p>
                      <p className="text-xs text-blue-mid">{place.kind}</p>
                    </div>
                    <p className="shrink-0 rounded-full bg-blue-deep px-2.5 py-1 text-sm font-semibold text-white">
                      {place.rating.toFixed(1)}
                      <span className="ml-1 text-xs font-medium text-blue-pale">
                        / 5
                      </span>
                    </p>
                  </div>
                  <p className="mt-2 text-sm leading-relaxed text-foreground">
                    {place.sells}
                  </p>
                  <p className="mt-1 text-xs text-blue-mid">
                    {place.reviewCount.toLocaleString()} public ratings
                    {miles !== null ? ` · about ${miles.toFixed(1)} mi` : ""}
                    {` · ${place.address}`}
                  </p>
                  <a
                    href={place.mapsHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-2 inline-flex text-sm font-semibold text-accent-strong underline-offset-2 hover:underline"
                  >
                    Open in Maps
                  </a>
                </li>
              );
            })}
          </ul>
        ) : null}
        <a
          href={supplies.searchHref}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-4 inline-flex text-sm font-semibold text-accent-strong underline-offset-2 hover:underline"
        >
          Search more stores nearby
        </a>
      </Modal>

      <Modal
        open={prioritizeOpen}
        title="Adjust for my time & budget"
        onClose={() => setPrioritizeOpen(false)}
      >
        <p className="mb-3 text-xs">
          Changes apply for this visit only. Your saved home profile stays the same.
        </p>
        <div className="max-h-[55vh] space-y-4 overflow-y-auto">
          <ChoiceGroup
            legend="What can you spend?"
            hint="Rough level only: not a dollar amount."
            value={budgetPreset}
            options={[
              { value: "zero", label: "Free only" },
              { value: "low", label: "Low" },
              { value: "moderate", label: "Moderate" },
              { value: "flexible", label: "Higher" },
              { value: "unconstrained", label: "Any" },
            ]}
            onChange={setBudgetPreset}
          />
          <ChoiceGroup
            legend="How much time do you have?"
            value={timePreset}
            options={[
              { value: "15", label: "15 min" },
              { value: "30", label: "30 min" },
              { value: "60", label: "60 min" },
              { value: "180", label: "3 hours" },
              { value: "unconstrained", label: "Any" },
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
            Live alerts are unavailable, so we will not invent a new checklist.
            Switch to Demo or wait for official alerts.
          </p>
        ) : null}
        <div className="mt-4">
          <Button onClick={() => void recalculate()} disabled={recalcStatus === "loading"}>
            {recalcStatus === "loading" ? (
              <Spinner label="Updating…" />
            ) : (
              "Update my checklist"
            )}
          </Button>
        </div>
      </Modal>
    </main>
  );
}

function SituationStrip({
  status,
  alert,
  hazards,
  allClear,
  locationLabel,
  source,
  isDemo,
  liveAlertsStatus,
}: {
  status: ResourceStatus;
  alert: ActiveHazard | null;
  hazards: ActiveHazard[];
  allClear: boolean | "unknown";
  locationLabel: string;
  source: string | undefined;
  isDemo: boolean;
  liveAlertsStatus: ResourceStatus;
}) {
  if (!isDemo && liveAlertsStatus === "loading") {
    return <LoadingCard title="Situation" label="Checking official alerts…" lines={2} />;
  }

  if (!isDemo && (liveAlertsStatus === "error" || liveAlertsStatus === "unavailable")) {
    return (
      <QueryState
        status={liveAlertsStatus}
        title="Situation"
        loadingLabel="Looking up alerts for your location."
        errorMessage={ALERT_ERROR}
        unavailableMessage={ALERT_UNAVAILABLE}
      />
    );
  }

  if (status === "loading") {
    return <LoadingCard title="Situation" label="Checking official alerts…" lines={2} />;
  }

  if (status === "error" || status === "unavailable") {
    return (
      <QueryState
        status={status}
        title="Situation"
        loadingLabel="Looking up alerts for your location."
        errorMessage={ALERT_ERROR}
        unavailableMessage={ALERT_UNAVAILABLE}
      />
    );
  }

  const tone = situationTone(alert, allClear);
  const title = alert
    ? alert.headline
    : allClear === true
      ? "No active alerts right now"
      : "We could not confirm an all-clear";
  const meta = alert
    ? plainSeverity(alert.severity)
    : allClear === true
      ? `Checked for ${locationLabel}`
      : "Empty is not the same as safe. We will not guess.";
  const extraCount = Math.max(0, hazards.length - (alert ? 1 : 0));
  const sourceLink = situationSourceLink(alert);

  return (
    <section
      className={`w-full min-w-0 rounded-3xl border bg-white p-4 shadow-[0_10px_30px_rgba(15,39,68,0.08)] ${tone.border}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${tone.dot}`} aria-hidden />
            <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted">
              Situation
            </p>
          </div>
          <p className="mt-1 break-words text-base font-semibold text-foreground">
            {title}
          </p>
          <p className={`mt-1 text-sm font-medium ${tone.text}`}>{meta}</p>
          {extraCount > 0 ? (
            <p className="mt-2 text-xs text-muted">
              +{extraCount} more alert{extraCount === 1 ? "" : "s"}
            </p>
          ) : null}
          <p className="mt-3 break-words text-xs text-muted">
            Source:{" "}
            <a
              href={sourceLink.href}
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-accent-strong underline-offset-2 hover:underline"
            >
              {sourceLink.label}
            </a>
            <span className="text-muted">
              {" · "}
              {sourceLabel(source, alert?.provenance)}
            </span>
          </p>
        </div>
      </div>
    </section>
  );
}

function SituationDetails({
  status,
  alert,
  hazards,
  allClear,
  source,
  observedAt,
  locationLabel,
}: {
  status: ResourceStatus;
  alert: ActiveHazard | null;
  hazards: ActiveHazard[];
  allClear: boolean | "unknown";
  source: string | undefined;
  observedAt: string | null;
  locationLabel: string;
}) {
  if (status !== "ready") {
    return (
      <p>
        Details appear when official alerts load. StormReady will not invent
        warnings.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {alert ? (
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted">
            Main alert
          </p>
          <p className="mt-1 font-semibold text-foreground">{alert.headline}</p>
          <p className="mt-1 text-sm text-muted">{plainSeverity(alert.severity)}</p>
          {isKnown(alert.instruction) ? (
            <p className="mt-3 text-sm leading-relaxed text-foreground">
              {alert.instruction}
            </p>
          ) : null}
        </div>
      ) : allClear === true ? (
        <p>
          An official check reported no active alerts for {locationLabel}.
        </p>
      ) : (
        <p>
          No alerts are listed right now, and this is not an all-clear.
          StormReady will not guess.
        </p>
      )}

      {hazards.length > 0 ? (
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted">
            Active alerts
          </p>
          <ul className="mt-2 flex flex-wrap gap-2">
            {hazards.slice(0, 8).map((hazard) => (
              <li
                key={hazard.id}
                className={`rounded-full px-3 py-1 text-xs font-semibold ${importanceChip(situationTone(hazard, false).level).chip}`}
              >
                {plainSeverity(hazard.severity)} · {hazard.kind.replace(/_/g, " ")}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <p className="text-xs text-muted">
        Source:{" "}
        <a
          href={situationSourceLink(alert).href}
          target="_blank"
          rel="noopener noreferrer"
          className="font-semibold text-accent-strong underline-offset-2 hover:underline"
        >
          {situationSourceLink(alert).label}
        </a>
        {" · "}
        {sourceLabel(source, alert?.provenance)} · {locationLabel}
        {" · "}
        {formatRelativeTime(
          observedAt ??
            (alert && isKnown(alert.onsetAt) ? alert.onsetAt : null),
        )}
      </p>
    </div>
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
    <div className="sr-mode-toggle">
      <p className="sr-mode-toggle-label">Data</p>
      <div className="sr-mode-toggle-group">
        <button
          type="button"
          aria-pressed={mode === "live"}
          onClick={onLive}
          data-active={mode === "live"}
        >
          Live
        </button>
        <button
          type="button"
          aria-pressed={mode === "demo"}
          onClick={() => onDemo(scenario)}
          data-active={mode === "demo"}
        >
          Demo
        </button>
      </div>
      {mode === "demo" ? (
        <div className="sr-mode-toggle-scenarios">
          {DEMO_SCENARIOS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => onDemo(option.value)}
              data-active={scenario === option.value}
            >
              {option.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function WhyActionPanel({ action }: { action: RecommendationView }) {
  const explanation = whyThisStepNeeded(action);

  return (
    <div className="-mx-1 space-y-3">
      <div className="overflow-hidden rounded-3xl bg-blue-deep px-4 py-3 text-white shadow-[0_12px_28px_rgba(13,31,60,0.2)]">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-blue-pale">
          Why this step
        </p>
        <h3 className="mt-1.5 text-xl font-semibold leading-snug tracking-tight">
          {action.title}
        </h3>
      </div>

      <div className="rounded-3xl border border-border bg-white p-3.5 shadow-[0_8px_20px_rgba(13,31,60,0.06)]">
        <p className="text-sm leading-relaxed text-navy">{explanation}</p>
      </div>
    </div>
  );
}

/** Plain-language purpose: what this step buys the household. */
function whyThisStepNeeded(action: RecommendationView): string {
  const title = action.title.toLowerCase();
  const rationale = isKnown(action.rationale) ? action.rationale : "";
  const blob = `${title} ${rationale} ${action.category}`;

  if (/medication|device supplies|grab|go bag/i.test(blob)) {
    return "A go bag with medications, charging cables, and a written list makes it easy to carry essentials you cannot replace if you have to leave or lose power. Pharmacies and outlets are not a sure thing once the alert turns into a move.";
  }
  if (/basement/i.test(blob)) {
    return "Floodwater hits below-grade rooms first, and outlets in that water are a shock risk. Getting upstairs, and cutting power only if floors and hands are dry, keeps people out of the water.";
  }
  if (/lowest floor|belongings off/i.test(title)) {
    return "Even a short flood ruins papers, electronics, and chemicals on the lowest floor. Moving people and those items up now means you are not sorting wreckage later.";
  }
  if (/mobility|wheelchair|crutches|elevator/i.test(blob)) {
    return "A mobility aid or elevator changes how this household leaves. Planning that route now means you are not inventing one in the dark or in rising water.";
  }
  if (/shutter|window|glass|plywood/i.test(blob)) {
    return "Unprotected glass is how wind and rain get inside. Covering windows, or staying away from them, keeps people and rooms safer when the wind picks up.";
  }
  if (/manufactured|mobile home/i.test(blob)) {
    return "A manufactured or mobile home is not a wind shelter. Leaving for a sturdier building is what keeps this household out of a structure that can come apart.";
  }
  if (/roof/i.test(blob)) {
    return "An older or unconfirmed roof is more likely to leak or lose covering in high wind. Checking it on a calm day is cheaper than repairing a wet house after a storm.";
  }
  if (/safe interior|interior room/i.test(blob)) {
    return "An interior room without windows is the part of the house that holds up best in wind. Naming that room now means everyone knows where to go without a debate.";
  }
  if (/surge|higher ground/i.test(blob)) {
    return "Storm surge and floodwater move faster than you can pack. Being on higher ground before the water arrives is what keeps people out of it.";
  }
  if (/flood zone/i.test(blob)) {
    return "If the flood zone is not confirmed, treating the lot as dry is a guess. Knowing the real risk is what tells you whether to move items up or leave.";
  }
  if (/pet/i.test(blob)) {
    return "Pets will not be allowed in every shelter or hotel. Confirming who goes where, and packing their food and carriers, keeps them with you instead of left behind.";
  }
  if (/backup power|outage|generator/i.test(blob) && /medical|device/i.test(blob)) {
    return "A power-dependent medical device fails when the outlet does. A no-power plan, extra batteries, or a place to go is what keeps that device running.";
  }
  if (/backup power|outage|generator/i.test(blob)) {
    return "Food, phones, and medical devices fail when the power does. A simple outage plan, even with no generator, is what keeps the household going through the dark hours.";
  }
  if (/pipe|faucet|cabinet/i.test(blob)) {
    return "Frozen pipes burst and flood the house from the inside. Dripping a faucet and opening cabinets is a no-cost way to keep water moving when it is that cold.";
  }
  if (/roads|stay off/i.test(blob)) {
    return "Ice and wrecks close roads faster than a forecast can update. Staying put until official travel is safe is what keeps this household off those roads.";
  }
  if (/warming|heat/i.test(blob)) {
    return "A cold house becomes a health risk once the heat or power fails. Knowing a warming place in advance is what keeps people from improvising in the dark.";
  }
  if (/wildfire|leave now|evac/i.test(blob) && action.category === "evacuate") {
    return "Wildfire and evacuation orders move faster than a last-minute packing list. Leaving when officials say to is what gets this household out of the burn or surge path.";
  }
  if (/document/i.test(blob)) {
    return "Paper IDs, insurance, and medical lists are what you need after a move, and they are the first things water and fire ruin. A waterproof copy in the bag travels with you.";
  }
  if (action.category === "evacuate") {
    return "Leaving on a known route, with a known place to go, is safer than deciding those things after the official order arrives.";
  }
  if (action.category === "medical") {
    return "A go bag with medications and device supplies makes it easy to carry essentials you cannot replace if you have to leave or lose power.";
  }
  if (action.category === "supplies") {
    return "Water, food, and a few household supplies on hand mean you are not shopping after stores close or roads flood.";
  }
  if (action.official) {
    return "This follows official guidance for the current alert. Acting on that guidance is what keeps the household aligned with the people issuing the warning.";
  }
  return "This step reduces a real risk for this home: it is easier to do now than to invent a plan after conditions get worse.";
}

function FuturePrepSection({
  risks,
  checkedSteps,
  onToggle,
}: {
  risks: ReturnType<typeof regionalRisksForHome>;
  checkedSteps: Record<string, boolean>;
  onToggle: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  if (risks.length === 0) return null;

  return (
    <section className="overflow-hidden rounded-3xl border border-border bg-white shadow-[0_10px_28px_rgba(13,31,60,0.06)]">
      <div className="bg-navy px-4 py-4 text-white">
        <h3 className="text-2xl font-semibold tracking-tight">
          Future preparedness
        </h3>
        <p className="mt-1.5 text-sm text-blue-pale">
          Your area is still prone to these risks. Work these on a calm week so
          you are ready before the next event.
        </p>
        <button
          type="button"
          onClick={() => setOpen((prev) => !prev)}
          aria-expanded={open}
          className="mt-3 rounded-xl bg-white/15 px-3 py-1.5 text-sm font-semibold text-white"
        >
          {open ? "Hide" : "Show checklist"}
        </button>
      </div>

      {open ? (
        <div className="space-y-5 p-4">
          {risks.map((risk) => {
            const done = risk.items.filter((item) => checkedSteps[item.id]).length;
            const pct = Math.round((done / risk.items.length) * 100);
            return (
              <div key={risk.id}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-navy">
                      Prone to {risk.label.toLowerCase()}
                    </p>
                    <p className="mt-0.5 text-xs text-muted">{risk.summary}</p>
                  </div>
                  <span className="shrink-0 rounded-full bg-blue-pale px-2.5 py-0.5 text-[11px] font-semibold text-blue-deep">
                    {pct}%
                  </span>
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-blue-pale">
                  <div
                    className="h-full rounded-full bg-blue-deep transition-[width] duration-300"
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <ul className="mt-3 space-y-2">
                  {risk.items.map((item) => {
                    const checked = Boolean(checkedSteps[item.id]);
                    const id = `future-${item.id}`;
                    return (
                      <li key={item.id}>
                        <label
                          htmlFor={id}
                          className={`flex cursor-pointer items-start gap-3 rounded-2xl border px-3 py-3 transition ${
                            checked
                              ? "border-blue-deep/30 bg-blue-pale/50"
                              : "border-border bg-blue-wash/60"
                          }`}
                        >
                          <input
                            id={id}
                            type="checkbox"
                            checked={checked}
                            onChange={() => onToggle(item.id)}
                            className="peer sr-only"
                          />
                          <span
                            className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 ${
                              checked
                                ? "border-blue-deep bg-blue-deep text-white"
                                : "border-[#c5cdd6] bg-white text-transparent"
                            }`}
                            aria-hidden
                          >
                            <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                              <path
                                d="M3.5 8.2 6.4 11l6.1-7"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              />
                            </svg>
                          </span>
                          <span className="min-w-0">
                            <span
                              className={`block text-sm font-semibold ${
                                checked ? "text-muted line-through" : "text-navy"
                              }`}
                            >
                              {item.title}
                            </span>
                            <span className="mt-0.5 block text-xs font-medium text-blue-deep">
                              {item.dueBy}
                            </span>
                            <span className="mt-1 block text-xs leading-relaxed text-muted">
                              {item.why}
                            </span>
                          </span>
                        </label>
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
        </div>
      ) : null}
    </section>
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

function ActionCard({
  action,
  rank,
  budgetClass: _budgetClass,
  dueBy,
  checked,
  onToggle,
  onWhy,
}: {
  action: RecommendationView;
  rank: number;
  budgetClass: Unknownable<BudgetClass>;
  dueBy: string;
  checked: boolean;
  onToggle: () => void;
  onWhy: () => void;
}) {
  const importance = importanceFromAction(action);
  const chip = importanceChip(importance);
  const checkboxId = `plan-step-${action.id}`;

  return (
    <article
      className={`rounded-3xl border border-border bg-white p-4 shadow-[0_10px_30px_rgba(15,39,68,0.06)] ${chip.bar} ${
        checked ? "bg-surface-elevated/60 opacity-80" : ""
      }`}
    >
      <div className="flex items-start gap-3">
        <label
          htmlFor={checkboxId}
          className="flex shrink-0 cursor-pointer items-start pt-0.5"
        >
          <input
            id={checkboxId}
            type="checkbox"
            checked={checked}
            onChange={onToggle}
            aria-label={`Mark step ${rank} done: ${action.title}`}
            className="peer sr-only"
          />
          <span
            className={`flex h-8 w-8 items-center justify-center rounded-full border-2 transition ${
              checked
                ? "border-success bg-success text-white"
                : "border-[#c5cdd6] bg-white text-transparent peer-focus-visible:ring-2 peer-focus-visible:ring-accent"
            }`}
            aria-hidden
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path
                d="M3.5 8.2 6.4 11l6.1-7"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </span>
        </label>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted">
                Step {rank}
                {checked ? " · Done" : ""}
              </p>
              <p
                className={`mt-1 text-sm font-semibold ${
                  checked ? "text-muted line-through" : "text-foreground"
                }`}
              >
                {action.title}
              </p>
              <p className="mt-1.5 text-sm font-medium text-blue-deep">
                {dueBy}
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <span
                  className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${chip.chip}`}
                >
                  {chip.label}
                </span>
                {typeof action.estimatedTimeMinutes === "number" ? (
                  <span className="text-xs text-muted">
                    About {action.estimatedTimeMinutes} min
                  </span>
                ) : null}
              </div>
            </div>
            <button
              type="button"
              onClick={onWhy}
              className="shrink-0 rounded-xl bg-surface-elevated px-3 py-1.5 text-sm font-semibold text-accent-strong"
            >
              Why?
            </button>
          </div>
        </div>
      </div>
    </article>
  );
}

function importanceChip(tone: ImportanceTone) {
  switch (tone) {
    case "critical":
      return {
        label: "Urgent",
        chip: "bg-danger/10 text-danger",
        step: "bg-danger",
        bar: "border-l-4 border-l-danger",
      };
    case "high":
      return {
        label: "Caution",
        chip: "bg-warning/15 text-warning",
        step: "bg-warning",
        bar: "border-l-4 border-l-warning",
      };
    default:
      return {
        label: "Prep",
        chip: "bg-blue-deep/10 text-blue-deep",
        step: "bg-blue-deep",
        bar: "border-l-4 border-l-blue-deep",
      };
  }
}

function situationTone(
  alert: ActiveHazard | null,
  allClear: boolean | "unknown",
): {
  level: ImportanceTone;
  dot: string;
  text: string;
  border: string;
} {
  if (alert) {
    if (alert.severity === "warning" || alert.severity === "emergency") {
      return {
        level: "critical",
        dot: "bg-danger",
        text: "text-danger",
        border: "border-danger/35",
      };
    }
    if (alert.severity === "watch" || alert.severity === "advisory") {
      return {
        level: "high",
        dot: "bg-warning",
        text: "text-warning",
        border: "border-warning/40",
      };
    }
  }
  if (allClear === true) {
    return {
      level: "ok",
      dot: "bg-success",
      text: "text-success",
      border: "border-success/30",
    };
  }
  return {
    level: "high",
    dot: "bg-warning",
    text: "text-warning",
    border: "border-warning/35",
  };
}

function plainSeverity(value: ActiveHazard["severity"]): string {
  switch (value) {
    case "emergency":
      return "Emergency: act now";
    case "warning":
      return "Warning: take action";
    case "watch":
      return "Watch: get ready";
    case "advisory":
      return "Advisory: stay aware";
    case "unknown":
      return "Level not confirmed";
    default:
      return formatSeverity(value);
  }
}

function plainCost(cost: BudgetClass): string {
  switch (cost) {
    case "zero":
      return "Usually free";
    case "low":
      return "Usually low cost";
    case "moderate":
      return "May need a moderate spend";
    case "flexible":
      return "May need a higher spend";
    default:
      return formatCostClass(cost);
  }
}

function fitsBudget(
  cost: BudgetClass,
  budget: Unknownable<BudgetClass>,
): boolean {
  if (budget === "unknown") return true;
  const order: BudgetClass[] = ["zero", "low", "moderate", "flexible"];
  return order.indexOf(cost) <= order.indexOf(budget);
}

function planHomeTitle(home: HomeProfile | null): string {
  if (!home) return "Location not set";
  if (isKnown(home.city) && isKnown(home.state)) return `${home.city}, ${home.state}`;
  if (isKnown(home.city)) return home.city;
  if (isKnown(home.postalCode)) return `ZIP ${home.postalCode}`;
  if (isKnown(home.addressLine)) return home.addressLine;
  return "Your home area";
}

function planHomeMeta(home: HomeProfile | null): string | null {
  if (!home) return null;
  const bits: string[] = [];
  if (isKnown(home.addressLine) && (isKnown(home.city) || isKnown(home.postalCode))) {
    bits.push(home.addressLine);
  }
  if (isKnown(home.postalCode) && !(isKnown(home.city) && isKnown(home.state))) {
    // title already shows ZIP alone; skip duplicate
  } else if (isKnown(home.postalCode) && isKnown(home.city)) {
    bits.push(home.postalCode);
  }
  return bits.length ? bits.join(" · ") : null;
}

function alertAreaRelation(
  home: HomeProfile | null,
  alert: ActiveHazard | null,
  locationLabel: string,
  allClear: boolean | "unknown",
): string {
  if (!alert) {
    if (allClear === true) {
      return `No active alert polygons for ${locationLabel}.`;
    }
    return "Alert coverage for your address is not confirmed yet.";
  }

  const label = locationLabel.toLowerCase();
  const county =
    home?.location && isKnown(home.location.county)
      ? home.location.county.toLowerCase()
      : "";
  const city = home && isKnown(home.city) ? home.city.toLowerCase() : "";
  const state = home && isKnown(home.state) ? home.state.toLowerCase() : "";

  if (county && label.includes(county)) {
    return `Covers ${locationLabel} · includes your county. Alerts only apply inside the official zone.`;
  }
  if (city && label.includes(city)) {
    return `Issued for ${locationLabel} · includes your city. Confirm your street is inside the zone.`;
  }
  if (state && (label.includes(state) || label.includes(`, ${state}`))) {
    return `Regional alert for ${locationLabel}. May not cover every neighborhood · check the map.`;
  }
  return `Drawn for ${locationLabel}. Distance varies by zone · open Details / Weather.gov to confirm your address.`;
}

function situationSourceLink(alert: ActiveHazard | null): {
  href: string;
  label: string;
} {
  if (alert && isKnown(alert.nwsEventId) && /^https?:\/\//i.test(alert.nwsEventId)) {
    return { href: alert.nwsEventId, label: "Official alert page" };
  }
  const weather = PREPAREDNESS_LINKS.find((link) => link.id === "weather-gov");
  return {
    href: weather?.href ?? "https://www.weather.gov/",
    label: weather?.title ?? "Weather.gov / National Weather Service",
  };
}

function dueByLabel(
  action: RecommendationView,
  alert: ActiveHazard | null,
  alertsStatus: ResourceStatus,
): string {
  const horizon = resolvePlanHorizon(action.timeframe, action.horizon);
  const urgent =
    action.priority === "critical" ||
    action.hardConstraint ||
    action.official ||
    horizon === "now";

  if (alertsStatus !== "ready") {
    if (urgent) return "Do today";
    if (horizon === "long_term") return "Do within a week";
    return "Do within 2 days";
  }

  const endsMs =
    alert && isKnown(alert.endsAt) ? Date.parse(alert.endsAt) : Number.NaN;
  const onsetMs =
    alert && isKnown(alert.onsetAt) ? Date.parse(alert.onsetAt) : Number.NaN;
  const now = Date.now();

  if (!Number.isNaN(endsMs) && endsMs > now) {
    const hoursLeft = (endsMs - now) / (1000 * 60 * 60);
    if (urgent || hoursLeft <= 24) return "Do today";
    if (hoursLeft <= 48) return "Do within 2 days";
    if (hoursLeft <= 24 * 7) {
      const days = Math.max(2, Math.ceil(hoursLeft / 24));
      return `Do within ${days} days`;
    }
  }

  if (!Number.isNaN(onsetMs) && onsetMs > now) {
    const hoursUntil = (onsetMs - now) / (1000 * 60 * 60);
    if (hoursUntil <= 24) return "Do today, before it starts";
    if (hoursUntil <= 48) return "Do within 2 days";
    if (hoursUntil <= 24 * 7) {
      const days = Math.max(2, Math.ceil(hoursUntil / 24) - 1);
      return `Do within ${days} days`;
    }
    return "Do within a week";
  }

  if (alert?.severity === "warning" || alert?.severity === "emergency") {
    return urgent || horizon !== "long_term" ? "Do today" : "Do within 2 days";
  }

  if (alert?.severity === "watch" || alert?.severity === "advisory") {
    if (urgent) return "Do today";
    if (horizon === "long_term") return "Do within a week";
    return "Do within 2 days";
  }

  if (urgent) return "Do today";
  if (horizon === "long_term") return "Do within a week";
  return "Do within 2 days";
}

function pickPrimaryAlert(hazards: ActiveHazard[]): ActiveHazard | null {
  if (hazards.length === 0) return null;
  return [...hazards].sort(
    (a, b) => SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity],
  )[0];
}

function sourceLabel(source?: string, fallback?: string): string {
  const value = source ?? fallback;
  if (value === "external_source") return "Official weather source";
  if (value === "user_reported") return "You reported this";
  return "Source not confirmed";
}
