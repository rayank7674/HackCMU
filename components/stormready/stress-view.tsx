"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { StressCascade } from "@/components/stormready/stress-cascade";
import { StressScene } from "@/components/stormready/stress-scene";
import {
  ErrorNote,
  LoadingCard,
  Spinner,
} from "@/components/stormready/query-state";
import { UnavailableNote } from "@/components/stormready/unavailable-note";
import {
  SIMPLE_POWER_OUTAGE_PRESET_ID,
  STRESS_ADVANCED_SUMMARY,
  STRESS_FLOW_COPY,
  STRESS_HEADLINE,
  STRESS_MIN_SEARCH_LABEL,
  STRESS_NEXT_STEPS,
  STRESS_RUN_POWER_OUTAGE,
  STRESS_RUN_THIS_SCENARIO,
  STRESS_SEE_ON_MAP,
  STRESS_SUGGEST_NEXT,
  STRESS_UPDATE_PLAN,
  STRESS_WEAKEST_LINK,
  STRESS_WORST_SEARCH_LABEL,
  friendlyDisruptionLabel,
  friendlyDisruptionSentence,
} from "@/lib/stress/copy";
import {
  HOUSE_HITS,
  STRESS_PRESETS,
  hitIsInSeason,
  parseHouseHit,
  postStress,
  presetsForHit,
  seasonForHome,
  visibleHits,
  type HouseHit,
  type StressRequest,
} from "@/lib/stress";
import type {
  DependencyGraph,
  DisruptionLevel,
  MinBreakdown,
  NodeState,
  StressResult,
  StressScenario,
  WorstCase,
} from "@/lib/stress";
import { fetchAlerts, type ResourceStatus } from "@/lib/stormready-api";
import { isKnown, type HazardState, type HomeProfile } from "@/lib/stormready";
import { formatCostClass } from "@/lib/stormready-format";
import { useProfile } from "@/lib/use-profile";

export const STRESS_MODELED_COPY =
  "Simulated planning scenario. Modeled under your home details - not a forecast, not official alerts, and not a safety score.";

export const STRESS_FORTIFY_UNAVAILABLE =
  "Fortify needs an official hazard state. FaultLine will not invent alerts or an all-clear.";

export const STRESS_ONBOARDING_COPY =
  "Stress Test needs a home profile. Finish setup first - FaultLine will not invent one.";

type SimulatePayload = {
  graph: DependencyGraph;
  result: StressResult;
};

type FortifyAction = {
  id: string;
  title: string;
  body: string;
  costClass?: string;
  official?: boolean;
};

type FortifyPayload = {
  result: StressResult;
  selected: FortifyAction[];
  notes: string[];
  shortfall: string | null;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isDisruption(value: unknown): value is DisruptionLevel {
  return (
    value === "none" ||
    value === "constrained" ||
    value === "major" ||
    value === "critical"
  );
}

function parseNode(value: unknown): NodeState | null {
  if (!isRecord(value) || typeof value.id !== "string") return null;
  if (typeof value.label !== "string" || !isDisruption(value.level)) return null;
  if (typeof value.capacity !== "number") return null;
  return value as unknown as NodeState;
}

export function parseStressResult(value: unknown): StressResult | null {
  if (!isRecord(value)) return null;
  if (value.modeled !== true || value.forecast !== false) return null;
  if (!isDisruption(value.disruptionLevel)) return null;
  if (typeof value.householdAccess !== "number") return null;
  if (!Array.isArray(value.cascadePath) || !Array.isArray(value.nodes)) return null;
  const nodes = value.nodes.map(parseNode).filter((node): node is NodeState => node !== null);
  const firstBreak = value.firstBreak == null ? null : parseNode(value.firstBreak);
  return {
    ...(value as unknown as StressResult),
    nodes,
    firstBreak,
    cascadePath: value.cascadePath.filter((item): item is string => typeof item === "string"),
  };
}

function parseGraph(value: unknown): DependencyGraph | null {
  if (!isRecord(value) || !Array.isArray(value.nodes) || !Array.isArray(value.edges)) {
    return null;
  }
  return value as unknown as DependencyGraph;
}

export function parseSimulatePayload(value: unknown): SimulatePayload | null {
  if (!isRecord(value) || value.ok !== true) return null;
  const result = parseStressResult(value.result);
  const graph = parseGraph(value.graph);
  if (!result || !graph) return null;
  return { graph, result };
}

export function parseMinBreakdown(value: unknown): MinBreakdown | null {
  if (!isRecord(value) || value.ok !== true) return null;
  if (value.status === "no_breakdown") {
    return {
      status: "no_breakdown",
      result: value.result == null ? null : parseStressResult(value.result),
    };
  }
  if (value.status !== "found") return null;
  const result = parseStressResult(value.result);
  if (!result || !isRecord(value.scenario)) return null;
  return {
    status: "found",
    scenario: value.scenario as unknown as StressScenario,
    result,
    perturbationCount: typeof value.perturbationCount === "number" ? value.perturbationCount : 0,
    severityRank: typeof value.severityRank === "number" ? value.severityRank : 0,
  };
}

export function parseWorstCase(value: unknown): WorstCase | null {
  const found = parseMinBreakdown(value);
  if (!found || found.status !== "found") return null;
  return found;
}

export function parseFortifyPayload(value: unknown): FortifyPayload | "unavailable" | null {
  if (!isRecord(value)) return null;
  if (value.ok === false && value.reason === "hazard_state_missing") {
    return "unavailable";
  }
  if (value.ok !== true || !isRecord(value.fortify)) return null;
  const result = parseStressResult(value.result);
  if (!result) return null;
  const selectedRaw = Array.isArray(value.fortify.selected) ? value.fortify.selected : [];
  const selected: FortifyAction[] = selectedRaw.flatMap((item) => {
    if (!isRecord(item) || typeof item.id !== "string" || typeof item.title !== "string") {
      return [];
    }
    return [
      {
        id: item.id,
        title: item.title,
        body: typeof item.body === "string" ? item.body : "",
        costClass: typeof item.costClass === "string" ? item.costClass : undefined,
        official: item.official === true,
      },
    ];
  });
  const notes = Array.isArray(value.fortify.notes)
    ? value.fortify.notes.filter((note): note is string => typeof note === "string")
    : [];
  const shortfall =
    typeof value.fortify.shortfall === "string" ? value.fortify.shortfall : null;
  return { result, selected, notes, shortfall };
}

async function runStress(body: StressRequest): Promise<unknown> {
  try {
    return await postStress(body);
  } catch {
    return { ok: false, reason: "network" };
  }
}

function disruptionLabel(level: DisruptionLevel): string {
  return friendlyDisruptionLabel(level);
}

export function StressView() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const requestedHit = parseHouseHit(searchParams.get("hit"));
  const { profile, hydrated } = useProfile();
  const presets = STRESS_PRESETS;
  const [pickedHit, setPickedHit] = useState<HouseHit | null>(null);
  const [showAllHits, setShowAllHits] = useState(false);
  const [presetOverride, setPresetOverride] = useState<string | null>(null);
  const [simulateStatus, setSimulateStatus] = useState<ResourceStatus>("idle");
  const [simulateError, setSimulateError] = useState<string | null>(null);
  const [simulated, setSimulated] = useState<SimulatePayload | null>(null);
  const [minStatus, setMinStatus] = useState<ResourceStatus>("idle");
  const [minResult, setMinResult] = useState<MinBreakdown | null>(null);
  const [worstStatus, setWorstStatus] = useState<ResourceStatus>("idle");
  const [worstResult, setWorstResult] = useState<WorstCase | null>(null);
  const [hazards, setHazards] = useState<HazardState | null>(null);
  const [hazardsStatus, setHazardsStatus] = useState<ResourceStatus>("idle");
  const [fortifyStatus, setFortifyStatus] = useState<ResourceStatus>("idle");
  const [fortify, setFortify] = useState<FortifyPayload | null>(null);

  const hasProfile = Boolean(profile.home);
  const home = profile.home;
  const household = profile.household;
  const season = useMemo(() => seasonForHome(home), [home]);
  const availableHits = useMemo(
    () => visibleHits(season, showAllHits),
    [season, showAllHits],
  );
  const hit = pickedHit ?? requestedHit;
  const hitPresets = useMemo(
    () => (hit ? presetsForHit(hit, presets) : []),
    [hit, presets],
  );
  const presetId =
    (presetOverride && hitPresets.some((item) => item.id === presetOverride)
      ? presetOverride
      : null) ??
    hitPresets[0]?.id ??
    SIMPLE_POWER_OUTAGE_PRESET_ID;
  const scenario = useMemo(() => {
    const fromHit = hitPresets.find((item) => item.id === presetId);
    return fromHit ?? hitPresets[0] ?? presets.find((item) => item.id === presetId) ?? presets[0];
  }, [hitPresets, presetId, presets]);

  useEffect(() => {
    if (hydrated && !hasProfile) {
      router.replace("/onboarding");
    }
  }, [hasProfile, hydrated, router]);

  useEffect(() => {
    if (!hydrated || !home) return;
    let cancelled = false;
    void (async () => {
      setHazardsStatus("loading");
      const result = await fetchAlerts({
        addressLine: isKnown(home.addressLine) ? home.addressLine : undefined,
        postalCode: isKnown(home.postalCode) ? home.postalCode : undefined,
        city: isKnown(home.city) ? home.city : undefined,
        state: isKnown(home.state) ? home.state : undefined,
        location: home.location,
      });
      if (cancelled) return;
      if (result.ok) {
        setHazards(result.data);
        setHazardsStatus("ready");
        return;
      }
      setHazards(null);
      setHazardsStatus(result.reason);
    })();
    return () => {
      cancelled = true;
    };
  }, [hydrated, home]);

  async function runSimulate(
    nextHome: HomeProfile,
    nextPreset = scenario,
    nextPresetId?: string,
  ) {
    const chosen =
      (nextPresetId
        ? presets.find((item) => item.id === nextPresetId)
        : null) ?? nextPreset;
    if (!chosen) return;
    if (nextPresetId) setPresetOverride(nextPresetId);
    setSimulateStatus("loading");
    setSimulateError(null);
    const payload = await runStress({
      action: "simulate",
      home: nextHome,
      household,
      scenario: { id: chosen.id },
    });
    const parsed = parseSimulatePayload(payload);
    if (!parsed) {
      setSimulated(null);
      setSimulateStatus("unavailable");
      setSimulateError("The stress service could not run this modeled scenario.");
      return;
    }
    setSimulated(parsed);
    setSimulateStatus("ready");
  }

  async function runMin() {
    if (!home) return;
    setMinStatus("loading");
    const payload = await runStress({ action: "min", home, household });
    const parsed = parseMinBreakdown(payload);
    if (!parsed) {
      setMinResult(null);
      setMinStatus("unavailable");
      return;
    }
    setMinResult(parsed);
    setMinStatus("ready");
  }

  async function runWorst() {
    if (!home) return;
    setWorstStatus("loading");
    const payload = await runStress({ action: "worst", home, household });
    const parsed = parseWorstCase(payload);
    if (!parsed) {
      setWorstResult(null);
      setWorstStatus("unavailable");
      return;
    }
    setWorstResult(parsed);
    setWorstStatus("ready");
  }

  async function runFortify() {
    if (!home) return;
    if (hazardsStatus !== "ready" || !hazards) {
      setFortify(null);
      setFortifyStatus("unavailable");
      return;
    }
    setFortifyStatus("loading");
    const payload = await runStress({
      action: "fortify",
      home,
      household,
      scenario: scenario ? { id: scenario.id } : undefined,
      hazards,
    });
    const parsed = parseFortifyPayload(payload);
    if (parsed === "unavailable") {
      setFortify(null);
      setFortifyStatus("unavailable");
      return;
    }
    if (!parsed) {
      setFortify(null);
      setFortifyStatus("error");
      return;
    }
    setFortify(parsed);
    setFortifyStatus("ready");
  }

  if (!hydrated) {
    return (
      <main className="flex flex-1 flex-col">
        <div className="px-5 py-8">
          <LoadingCard title="Stress Test" label="Loading this device…" lines={2} />
        </div>
      </main>
    );
  }

  if (!hasProfile || !home) {
    return (
      <main className="flex flex-1 flex-col">
        <div className="flex flex-1 flex-col px-5 pb-8 pt-6">
          <h2 className="text-2xl font-semibold tracking-tight">Home profile needed</h2>
          <p className="mt-3 text-sm leading-relaxed text-muted">{STRESS_ONBOARDING_COPY}</p>
          <div className="mt-8">
            <Button href="/onboarding">Go to setup</Button>
          </div>
        </div>
      </main>
    );
  }

  const result = simulated?.result ?? null;
  const graph = simulated?.graph ?? null;

  return (
    <main className="flex min-h-full flex-1 flex-col">
      <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-4 px-5 pb-8 pt-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-accent">
            {STRESS_FLOW_COPY}
          </p>
          <h2 className="mt-1 text-xl font-semibold tracking-tight text-foreground">
            {STRESS_HEADLINE}
          </h2>
          <p className="mt-1 text-sm leading-relaxed text-muted">{STRESS_MODELED_COPY}</p>
        </div>

        <Card eyebrow="What hits this house" title="Pick a modeled impact">
          <p className="text-sm leading-relaxed">
            Start with how this dwelling is stressed. Season filters hide
            off-season hits unless you show all. Simulated planning only.
          </p>
          <p className="mt-2 text-xs leading-relaxed text-muted">
            {season.label}. {season.sourceNote}
          </p>
          <div className="mt-3 flex flex-col gap-2">
            {HOUSE_HITS.filter((item) => availableHits.includes(item.id)).map((item) => {
              const selected = hit === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => {
                    setPickedHit(item.id);
                    setSimulated(null);
                    setSimulateStatus("idle");
                    setPresetOverride(null);
                  }}
                  className={`min-h-11 rounded-2xl border px-3 py-2 text-left text-sm font-medium transition ${
                    selected
                      ? "border-accent-strong bg-accent-strong text-background"
                      : "border-border bg-surface text-foreground hover:bg-surface-elevated"
                  }`}
                >
                  <span className="block">{item.label}</span>
                  <span className={`mt-0.5 block text-xs font-normal ${selected ? "text-background/80" : "text-muted"}`}>
                    {item.body}
                  </span>
                </button>
              );
            })}
          </div>
          {!showAllHits && HOUSE_HITS.some((item) => !hitIsInSeason(item.id, season)) ? (
            <button
              type="button"
              onClick={() => setShowAllHits(true)}
              className="mt-3 text-sm font-semibold text-accent-strong"
            >
              Show all seasonal hits
            </button>
          ) : null}
          {hit && scenario ? (
            <>
              <p className="mt-3 text-xs leading-relaxed text-muted">{scenario.disclaimer}</p>
              {hitPresets.length > 1 ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  {hitPresets.map((item) => {
                    const selected = item.id === presetId;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        aria-pressed={selected}
                        onClick={() => setPresetOverride(item.id)}
                        className={`min-h-11 rounded-2xl border px-3 py-2 text-left text-xs font-medium transition ${
                          selected
                            ? "border-accent-strong bg-accent-strong text-background"
                            : "border-border bg-surface text-foreground hover:bg-surface-elevated"
                        }`}
                      >
                        {item.label}
                      </button>
                    );
                  })}
                </div>
              ) : null}
              <div className="mt-3 flex flex-col gap-2">
                {hit === "power" ? (
                  <Button
                    onClick={() =>
                      void runSimulate(home, scenario, SIMPLE_POWER_OUTAGE_PRESET_ID)
                    }
                    disabled={simulateStatus === "loading"}
                  >
                    {simulateStatus === "loading" ? "Running model…" : STRESS_RUN_POWER_OUTAGE}
                  </Button>
                ) : (
                  <Button
                    onClick={() => void runSimulate(home, scenario)}
                    disabled={simulateStatus === "loading"}
                  >
                    {simulateStatus === "loading" ? "Running model…" : STRESS_RUN_THIS_SCENARIO}
                  </Button>
                )}
              </div>
            </>
          ) : null}
          {hit ? null : (
            <p className="mt-3 text-xs leading-relaxed text-muted">
              Choose what hits this house before the cascade loads. FaultLine
              will not invent a result.
            </p>
          )}
        </Card>

        {simulateStatus === "loading" ? (
          <LoadingCard title="What could go wrong?" label="Simulating household dependencies…" />
        ) : null}
        {simulateStatus === "unavailable" || simulateStatus === "error" ? (
          <ErrorNote title="Stress Test unavailable">
            {simulateError ?? "The modeled scenario could not be loaded."}
          </ErrorNote>
        ) : null}

        {simulateStatus === "ready" && result ? (
          <div className="sr-stagger">
            <Card
              eyebrow={STRESS_WEAKEST_LINK}
              title={result.firstBreak?.label ?? "No weakest link in this model"}
            >
              {result.firstBreak ? (
                <p>
                  {friendlyDisruptionSentence(result.firstBreak.level)} Capacity{" "}
                  {Math.round(result.firstBreak.capacity)} / 100 under this
                  simulation - not a safety score.
                </p>
              ) : (
                <p>
                  This preset did not model an initial break. That is not an
                  official all-clear.
                </p>
              )}
              <p className="mt-2 text-xs">
                Whole-home access: {disruptionLabel(result.disruptionLevel)} ·{" "}
                {Math.round(result.householdAccess)} / 100 in this simulation.
                This is not a forecast and not a safety score.
              </p>
            </Card>

            <Card eyebrow="Household view" title="How one break can cascade">
              <StressScene result={result} edges={graph?.edges ?? []} home={home} />
              <p className="mt-3 text-xs">
                <Link href="/map" className="font-semibold text-accent-strong">
                  {STRESS_SEE_ON_MAP}
                </Link>
                {" - "}
                optional map overlay. Still modeled, not a utility twin.
              </p>
              {result.affected.length > 0 ? (
                <ul className="mt-3 space-y-1 text-xs">
                  {result.affected.map((node) => (
                    <li key={node.id}>
                      {node.label}: {disruptionLabel(node.level)}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-3 text-xs">
                  No downstream systems were marked affected in this model.
                </p>
              )}
            </Card>
          </div>
        ) : null}

        <Card eyebrow={STRESS_NEXT_STEPS} title="Fortify the weak spot">
          <p className="mb-3 text-xs leading-relaxed">
            Suggested actions use official hazard state when it is available.
            FaultLine will not invent an all-clear.
          </p>
          {hazardsStatus === "loading" || hazardsStatus === "idle" ? (
            <Spinner label="Checking official hazard state…" />
          ) : hazardsStatus !== "ready" || !hazards ? (
            <UnavailableNote title="Next steps unavailable">
              {STRESS_FORTIFY_UNAVAILABLE}
            </UnavailableNote>
          ) : (
            <>
              <Button
                onClick={() => void runFortify()}
                disabled={fortifyStatus === "loading"}
              >
                {fortifyStatus === "loading" ? "Building list…" : STRESS_SUGGEST_NEXT}
              </Button>
              {fortifyStatus === "unavailable" ? (
                <div className="mt-3">
                  <UnavailableNote title="Next steps unavailable">
                    {STRESS_FORTIFY_UNAVAILABLE}
                  </UnavailableNote>
                </div>
              ) : null}
              {fortifyStatus === "error" ? (
                <div className="mt-3">
                  <ErrorNote title="Next steps could not run">
                    The request failed. FaultLine will not invent a list
                    or an all-clear.
                  </ErrorNote>
                </div>
              ) : null}
              {fortifyStatus === "ready" && fortify ? (
                <ul className="mt-3 space-y-2">
                  {fortify.selected.length === 0 ? (
                    <li className="text-sm">
                      No next steps were selected under current constraints.
                      This is not an all-clear.
                    </li>
                  ) : (
                    fortify.selected.map((action) => (
                      <li
                        key={action.id}
                        className="rounded-2xl border border-border bg-surface px-3 py-2"
                      >
                        <p className="text-sm font-semibold text-foreground">{action.title}</p>
                        {action.body ? (
                          <p className="mt-1 text-xs leading-relaxed text-muted">{action.body}</p>
                        ) : null}
                        <p className="mt-1 text-[11px] text-muted">
                          {action.official ? "Official action · " : ""}
                          {action.costClass ? formatCostClass(action.costClass) : "Cost class unknown"}
                        </p>
                      </li>
                    ))
                  )}
                </ul>
              ) : null}
            </>
          )}
          <div className="mt-3">
            <Button href="/home" variant="secondary">
              {STRESS_UPDATE_PLAN}
            </Button>
          </div>
        </Card>

        <details className="rounded-2xl border border-border bg-surface p-4">
          <summary className="cursor-pointer text-sm font-semibold text-foreground">
            {STRESS_ADVANCED_SUMMARY}
          </summary>
          <p className="mt-2 text-xs leading-relaxed text-muted">
            Bounded searches over modeled power, road, transport, and water
            stress. Results stay simulated - not a forecast.
          </p>
          {simulateStatus === "ready" && result ? (
            <div className="mt-3">
              <p className="text-xs font-semibold text-foreground">2D diagram</p>
              <StressCascade
                nodes={result.nodes}
                edges={graph?.edges ?? []}
                cascadePath={result.cascadePath}
                weakestId={result.firstBreak?.id}
              />
              <p className="mt-2 text-xs text-muted">
                Path:{" "}
                {result.cascadePath.length > 0 ? result.cascadePath.join(" → ") : "None modeled"}
              </p>
            </div>
          ) : null}
          <div className="mt-3 flex flex-col gap-2">
            <Button variant="secondary" onClick={() => void runMin()} disabled={minStatus === "loading"}>
              {minStatus === "loading" ? "Searching…" : STRESS_MIN_SEARCH_LABEL}
            </Button>
            <Button variant="secondary" onClick={() => void runWorst()} disabled={worstStatus === "loading"}>
              {worstStatus === "loading" ? "Searching…" : STRESS_WORST_SEARCH_LABEL}
            </Button>
          </div>
          {minStatus === "ready" && minResult ? (
            <div className="mt-3 text-sm">
              {minResult.status === "found" ? (
                <p>
                  Smallest modeled break: {minResult.scenario.label}. Weakest
                  link {minResult.result.firstBreak?.label ?? "unspecified"} (
                  {disruptionLabel(minResult.result.disruptionLevel)}).
                </p>
              ) : (
                <p>
                  No breakdown was found in the bounded search. That is not an
                  all-clear and not a safety score.
                </p>
              )}
            </div>
          ) : null}
          {minStatus === "unavailable" ? (
            <p className="mt-3 text-xs text-muted">Smallest-change search is unavailable.</p>
          ) : null}
          {worstStatus === "ready" && worstResult ? (
            <p className="mt-3 text-sm">
              Toughest modeled case: {worstResult.scenario.label}. Weakest link{" "}
              {worstResult.result.firstBreak?.label ?? "unspecified"} (
              {disruptionLabel(worstResult.result.disruptionLevel)}).
            </p>
          ) : null}
          {worstStatus === "unavailable" ? (
            <p className="mt-3 text-xs text-muted">Toughest-case search is unavailable.</p>
          ) : null}
          {minStatus === "loading" || worstStatus === "loading" ? (
            <div className="mt-3">
              <Spinner label="Searching modeled scenarios…" />
            </div>
          ) : null}
          {simulateStatus === "ready" && result && result.assumptions.length > 0 ? (
            <div className="mt-4">
              <p className="text-xs font-semibold text-foreground">What this model used</p>
              <ul className="mt-1 list-disc space-y-1 pl-4 text-xs text-muted">
                {result.assumptions.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </details>

        <p className="text-xs leading-relaxed text-muted">
          Optional mode. Open your{" "}
          <Link href="/home" className="font-semibold text-accent-strong">
            plan
          </Link>{" "}
          for live official alerts. Stress Test never replaces them.
        </p>
      </div>
    </main>
  );
}
