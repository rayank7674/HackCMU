"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { StressCascade } from "@/components/stormready/stress-cascade";
import {
  ErrorNote,
  LoadingCard,
  Spinner,
} from "@/components/stormready/query-state";
import { UnavailableNote } from "@/components/stormready/unavailable-note";
import { STRESS_PRESETS, postStress, type StressRequest } from "@/lib/stress";
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
  "Simulated planning scenario. Modeled under your home details — not a forecast, not official alerts, and not a safety score.";

export const STRESS_FORTIFY_UNAVAILABLE =
  "Fortify needs an official hazard state. StormReady will not invent alerts or an all-clear.";

export const STRESS_ONBOARDING_COPY =
  "Stress Test needs a home profile. Finish setup first — StormReady will not invent one.";

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
  if (level === "none") return "No modeled disruption";
  if (level === "constrained") return "Constrained (modeled)";
  if (level === "major") return "Major (modeled)";
  return "Critical (modeled)";
}

export function StressView() {
  const router = useRouter();
  const { profile, hydrated } = useProfile();
  const presets = STRESS_PRESETS;
  const [presetId, setPresetId] = useState(presets[0]?.id ?? "power-12h");
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
  const scenario = useMemo(
    () => presets.find((item) => item.id === presetId) ?? presets[0],
    [presetId, presets],
  );

  useEffect(() => {
    if (hydrated && !hasProfile) {
      router.replace("/onboarding");
    }
  }, [hasProfile, hydrated, router]);

  useEffect(() => {
    if (!hydrated || !home) return;
    let cancelled = false;
    setHazardsStatus("loading");
    (async () => {
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

  async function runSimulate(nextHome: HomeProfile, nextPreset = scenario) {
    if (!nextPreset) return;
    setSimulateStatus("loading");
    setSimulateError(null);
    const payload = await runStress({
      action: "simulate",
      home: nextHome,
      household,
      scenario: { id: nextPreset.id },
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
        <Header title="Stress Test" />
        <div className="px-5 py-8">
          <LoadingCard title="Stress Test" label="Loading this device…" lines={2} />
        </div>
      </main>
    );
  }

  if (!hasProfile || !home) {
    return (
      <main className="flex flex-1 flex-col">
        <Header title="Stress Test" />
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
      <Header title="Stress Test" />
      <div className="flex flex-1 flex-col gap-4 px-5 pb-8 pt-4">
        <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted">
          Optional modeled mode
        </p>
        <h2 className="text-lg font-semibold text-foreground">Test my preparedness</h2>
        <p className="text-sm leading-relaxed text-muted">{STRESS_MODELED_COPY}</p>

        <Card eyebrow="Scenario presets" title="Pick a simulated stress">
          <div className="flex flex-wrap gap-2">
            {presets.map((item) => {
              const selected = item.id === presetId;
              return (
                <button
                  key={item.id}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => setPresetId(item.id)}
                  className={`min-h-11 rounded-2xl border px-3 py-2 text-left text-xs font-medium transition ${
                    selected
                      ? "border-accent-strong bg-accent-strong text-white"
                      : "border-border bg-white text-foreground hover:bg-surface-elevated"
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
          </div>
          {scenario ? (
            <p className="mt-3 text-xs leading-relaxed text-muted">{scenario.disclaimer}</p>
          ) : null}
          <div className="mt-3">
            <Button
              onClick={() => void runSimulate(home)}
              disabled={simulateStatus === "loading"}
            >
              {simulateStatus === "loading" ? "Running model…" : "Run modeled scenario"}
            </Button>
          </div>
        </Card>

        {simulateStatus === "loading" ? (
          <LoadingCard title="Modeled cascade" label="Simulating household dependencies…" />
        ) : null}
        {simulateStatus === "unavailable" || simulateStatus === "error" ? (
          <ErrorNote title="Stress Test unavailable">
            {simulateError ?? "The modeled scenario could not be loaded."}
          </ErrorNote>
        ) : null}

        {simulateStatus === "ready" && result ? (
          <>
            <Card eyebrow="First break" title={result.firstBreak?.label ?? "No first break modeled"}>
              {result.firstBreak ? (
                <p>
                  {disruptionLabel(result.firstBreak.level)}. Capacity{" "}
                  {Math.round(result.firstBreak.capacity)} / 100 under this
                  simulation — not a safety score.
                </p>
              ) : (
                <p>
                  This preset did not model an initial break. That is not an
                  official all-clear.
                </p>
              )}
            </Card>

            <Card eyebrow="Modeled household access" title={disruptionLabel(result.disruptionLevel)}>
              <p>
                Capacity {Math.round(result.householdAccess)} / 100 in this
                simulation. This is not a forecast and not a safety score.
              </p>
              <p className="mt-2 text-xs">
                Cascade path:{" "}
                {result.cascadePath.length > 0 ? result.cascadePath.join(" → ") : "None modeled"}
              </p>
            </Card>

            <Card eyebrow="2D cascade" title="How stress can propagate">
              <StressCascade
                nodes={result.nodes}
                edges={graph?.edges ?? []}
                cascadePath={result.cascadePath}
              />
              <ul className="mt-3 space-y-1 text-xs">
                {result.affected.length > 0 ? (
                  result.affected.map((node) => (
                    <li key={node.id}>
                      {node.label}: {disruptionLabel(node.level)}
                    </li>
                  ))
                ) : (
                  <li>No downstream nodes were marked affected in this model.</li>
                )}
              </ul>
            </Card>

            {result.assumptions.length > 0 ? (
              <Card eyebrow="Assumptions" title="What this model used">
                <ul className="list-disc space-y-1 pl-4 text-xs">
                  {result.assumptions.map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
              </Card>
            ) : null}
          </>
        ) : null}

        <Card eyebrow="Search" title="Minimum breakdown and worst case">
          <p className="mb-3 text-xs leading-relaxed">
            Bounded searches over modeled power, road, transport, and water
            stress. Results stay simulated — not a forecast.
          </p>
          <div className="flex flex-col gap-2">
            <Button variant="secondary" onClick={() => void runMin()} disabled={minStatus === "loading"}>
              {minStatus === "loading" ? "Searching…" : "Find minimum breakdown"}
            </Button>
            <Button variant="secondary" onClick={() => void runWorst()} disabled={worstStatus === "loading"}>
              {worstStatus === "loading" ? "Searching…" : "Find worst case"}
            </Button>
          </div>
          {minStatus === "ready" && minResult ? (
            <div className="mt-3 text-sm">
              {minResult.status === "found" ? (
                <p>
                  Minimum modeled breakdown: {minResult.scenario.label}. First
                  break {minResult.result.firstBreak?.label ?? "unspecified"} (
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
            <p className="mt-3 text-xs text-muted">Minimum breakdown search is unavailable.</p>
          ) : null}
          {worstStatus === "ready" && worstResult ? (
            <p className="mt-3 text-sm">
              Worst modeled case: {worstResult.scenario.label}. First break{" "}
              {worstResult.result.firstBreak?.label ?? "unspecified"} (
              {disruptionLabel(worstResult.result.disruptionLevel)}).
            </p>
          ) : null}
          {worstStatus === "unavailable" ? (
            <p className="mt-3 text-xs text-muted">Worst-case search is unavailable.</p>
          ) : null}
          {minStatus === "loading" || worstStatus === "loading" ? (
            <div className="mt-3">
              <Spinner label="Searching modeled scenarios…" />
            </div>
          ) : null}
        </Card>

        <Card eyebrow="Fortify" title="Actions that address modeled breaks">
          {hazardsStatus === "loading" || hazardsStatus === "idle" ? (
            <Spinner label="Checking official hazard state…" />
          ) : hazardsStatus !== "ready" || !hazards ? (
            <UnavailableNote title="Fortify unavailable">
              {STRESS_FORTIFY_UNAVAILABLE}
            </UnavailableNote>
          ) : (
            <>
              <Button
                onClick={() => void runFortify()}
                disabled={fortifyStatus === "loading"}
              >
                {fortifyStatus === "loading" ? "Building list…" : "Show fortify list"}
              </Button>
              {fortifyStatus === "unavailable" ? (
                <div className="mt-3">
                  <UnavailableNote title="Fortify unavailable">
                    {STRESS_FORTIFY_UNAVAILABLE}
                  </UnavailableNote>
                </div>
              ) : null}
              {fortifyStatus === "error" ? (
                <div className="mt-3">
                  <ErrorNote title="Fortify could not run">
                    The fortify request failed. StormReady will not invent a list
                    or an all-clear.
                  </ErrorNote>
                </div>
              ) : null}
              {fortifyStatus === "ready" && fortify ? (
                <ul className="mt-3 space-y-2">
                  {fortify.selected.length === 0 ? (
                    <li className="text-sm">
                      No fortify actions were selected under current constraints.
                      This is not an all-clear.
                    </li>
                  ) : (
                    fortify.selected.map((action) => (
                      <li
                        key={action.id}
                        className="rounded-2xl border border-border bg-white px-3 py-2"
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
        </Card>

        <p className="text-xs leading-relaxed text-muted">
          Optional mode. Open your{" "}
          <Link href="/plan" className="font-semibold text-accent-strong">
            plan
          </Link>{" "}
          for live official alerts. Stress Test never replaces them.
        </p>
      </div>
    </main>
  );
}
