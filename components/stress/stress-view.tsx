"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ChoiceGroup } from "@/components/stormready/choice-field";
import { LoadingCard, Spinner } from "@/components/stormready/query-state";
import { CascadeView } from "@/components/stress/cascade-view";
import { useProfile } from "@/lib/use-profile";
import {
  compareCounterfactual,
  counterfactualBackupPower,
  customScenario,
  STRESS_DISCLAIMER,
  STRESS_PRESETS,
  type DisruptionLevel,
  type PowerPct,
  type RoadPct,
  type StressResult,
  type TransportStress,
} from "@/lib/stress";
import { fetchAlerts, fetchStress, type StressFortifyAction } from "@/lib/stormready-api";
import { runStress } from "@/lib/stress/run";
import { formatCostClass } from "@/lib/stormready-format";
import { isKnown } from "@/lib/stormready";
import { labelForCostUnits } from "@/lib/optimization";
import type { HazardState } from "@/types";

const DependencyMountain = dynamic(
  () =>
    import("@/components/stress/dependency-mountain").then(
      (mod) => mod.DependencyMountain,
    ),
  { ssr: false },
);

const LEVEL_LABEL: Record<DisruptionLevel, string> = {
  none: "None",
  constrained: "Constrained",
  major: "Major",
  critical: "Critical",
};

const HOW_IT_WORKS = [
  "This is a modeled household dependency graph, not official GIS or a utility map.",
  "You pick a simulated scenario (power, roads, transport). StormReady propagates those shocks through the graph.",
  "Unknown backup power is not treated as “no generator.” Counterfactuals only run when you confirmed you do not have backup power.",
  "Minimum breakdown and worst case search a tiny discrete grid within modeled bounds. They are not real-world predictions or forecasts.",
  "Fortify reuses the knapsack planner. Official and hard actions stay first. Cost badges are classes, not prices.",
];

export function StressView() {
  const { profile, hydrated } = useProfile();
  const [presetId, setPresetId] = useState(STRESS_PRESETS[0]?.id ?? "power-12h");
  const [useCustom, setUseCustom] = useState(false);
  const [power, setPower] = useState<PowerPct>(50);
  const [road, setRoad] = useState<RoadPct>(75);
  const [transport, setTransport] = useState<TransportStress>("unchanged");
  const [busy, setBusy] = useState<"idle" | "run" | "min" | "worst" | "fortify">(
    "idle",
  );
  const [result, setResult] = useState<StressResult | null>(null);
  const [searchNote, setSearchNote] = useState<string | null>(null);
  const [fortify, setFortify] = useState<StressFortifyAction[] | null>(null);
  const [fortifyError, setFortifyError] = useState<string | null>(null);
  const [counterfactual, setCounterfactual] = useState<{
    without: DisruptionLevel;
    withChange: DisruptionLevel;
  } | null>(null);
  const [webgl, setWebgl] = useState(false);

  useEffect(() => {
    setWebgl(detectWebGL());
  }, []);

  const scenario = useMemo(() => {
    if (useCustom) {
      return customScenario({
        powerAvailability: power,
        roadAccessibility: road,
        transport,
      });
    }
    return STRESS_PRESETS.find((item) => item.id === presetId) ?? STRESS_PRESETS[0]!;
  }, [useCustom, power, road, transport, presetId]);

  if (!hydrated) {
    return (
      <main className="flex flex-1 flex-col">
        <Header title="Preparedness test" backHref="/plan" />
        <div className="px-5 py-8">
          <LoadingCard title="Stress test" label="Loading this device…" lines={2} />
        </div>
      </main>
    );
  }

  if (!profile.home) {
    return (
      <main className="flex flex-1 flex-col">
        <Header title="Preparedness test" backHref="/plan" />
        <div className="flex flex-1 flex-col px-5 pb-8 pt-6">
          <h2 className="text-2xl font-semibold tracking-tight">
            Set up a home first
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-muted">
            Modeled stress tests need a household profile. StormReady will not
            invent a home or treat unknown backup power as no generator.
          </p>
          <div className="mt-8">
            <Button href="/onboarding">Get Started</Button>
          </div>
        </div>
      </main>
    );
  }

  const home = profile.home;
  const household = profile.household;

  async function runSimulate() {
    setBusy("run");
    setSearchNote(null);
    setFortify(null);
    setFortifyError(null);
    setCounterfactual(null);
    const local = runStress({
      home,
      household,
      scenario,
      action: "simulate",
    });
    if (local.ok) setResult(local.result);
    setBusy("idle");
  }

  async function runSearch(action: "min" | "worst") {
    setBusy(action);
    setFortify(null);
    setFortifyError(null);
    const remote = await fetchStress({
      home,
      household,
      scenario,
      action,
    });
    if (remote.ok && remote.data.result) {
      setResult(remote.data.result);
      setSearchNote(
        action === "min"
          ? remote.data.breakdown && "status" in remote.data.breakdown && remote.data.breakdown.status === "no_breakdown"
            ? "No modeled breakdown on this discrete grid."
            : "Minimum modeled breakdown within bounded search — not a real-world prediction."
          : "Worst case within modeled bounds, not a real-world prediction.",
      );
      setBusy("idle");
      return;
    }
    const local = runStress({ home, household, scenario, action });
    if (local.ok && local.result) {
      setResult(local.result);
      setSearchNote(
        action === "min"
          ? local.breakdown && "status" in local.breakdown && local.breakdown.status === "no_breakdown"
            ? "No modeled breakdown on this discrete grid."
            : "Minimum modeled breakdown within bounded search — not a real-world prediction."
          : "Worst case within modeled bounds, not a real-world prediction.",
      );
    }
    setBusy("idle");
  }

  async function runFortify() {
    if (!result) return;
    setBusy("fortify");
    setFortifyError(null);
    const alerts = await fetchAlerts({
      addressLine: isKnown(home.addressLine) ? home.addressLine : undefined,
      postalCode: isKnown(home.postalCode) ? home.postalCode : undefined,
      city: isKnown(home.city) ? home.city : undefined,
      state: isKnown(home.state) ? home.state : undefined,
      location: home.location,
    });
    if (!alerts.ok) {
      setFortify(null);
      setFortifyError(
        "Official alerts are unavailable, so StormReady will not invent a fortified plan or an all-clear.",
      );
      setBusy("idle");
      return;
    }
    const hazards = alerts.data;
    if (!usableHazards(hazards)) {
      setFortify(null);
      setFortifyError(
        "Alert status is not confirmed. StormReady will not invent warnings or treat this as all-clear.",
      );
      setBusy("idle");
      return;
    }

    const remote = await fetchStress({
      home,
      household,
      scenario: result.scenario,
      action: "fortify",
      hazards,
    });
    if (remote.ok && remote.data.optimization) {
      setFortify(remote.data.optimization.selected);
      setBusy("idle");
      return;
    }
    const local = runStress({
      home,
      household,
      scenario: result.scenario,
      action: "fortify",
      hazards,
    });
    if (local.ok && local.optimization) {
      setFortify(
        local.optimization.selected.map((action) => ({
          id: action.id,
          title: action.title,
          costClass: action.costClass,
          official: action.official,
          hardConstraint: action.hardConstraint,
          estimatedCostUnits: action.estimatedCostUnits,
        })),
      );
    } else if (!local.ok) {
      setFortifyError(
        "Could not fortify without a confirmed hazard state. StormReady will not invent alerts.",
      );
    }
    setBusy("idle");
  }

  function runCounterfactual() {
    if (!result || home.hasBackupPower !== false || !household) return;
    const compared = compareCounterfactual({
      home,
      household,
      scenario: result.scenario,
      variantHome: counterfactualBackupPower(home),
    });
    setCounterfactual({
      without: compared.disruptionWithout,
      withChange: compared.disruptionWith,
    });
  }

  return (
    <main className="flex min-h-full flex-1 flex-col">
      <Header title="Preparedness test" backHref="/plan" />
      <div className="flex flex-1 flex-col gap-4 px-5 pb-8 pt-4">
        <p
          role="note"
          className="rounded-2xl border border-warning/40 bg-warning/10 px-3 py-2 text-xs leading-relaxed text-foreground"
        >
          {STRESS_DISCLAIMER} Modeled, not a forecast. Disruption is an ordinal
          label, not a safety score.
        </p>

        <section>
          <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted">
            Modeled presets
          </p>
          <div className="mt-2 grid gap-2">
            {STRESS_PRESETS.map((item) => {
              const selected = !useCustom && presetId === item.id;
              const tampa = item.id === "tampa-demo";
              return (
                <button
                  key={item.id}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => {
                    setUseCustom(false);
                    setPresetId(item.id);
                  }}
                  className={`rounded-3xl border px-3 py-3 text-left ${
                    selected
                      ? "border-accent-strong bg-accent-strong text-white"
                      : "border-border bg-surface text-foreground"
                  }`}
                >
                  <p className="text-sm font-semibold">{item.label}</p>
                  {tampa ? (
                    <p
                      className={`mt-1 text-[11px] font-semibold ${
                        selected ? "text-white/90" : "text-warning"
                      }`}
                    >
                      modeled, not live NWS
                    </p>
                  ) : null}
                </button>
              );
            })}
          </div>
        </section>

        <Card eyebrow="Custom" title="Discrete sliders">
          <p className="mb-3 text-xs">
            Values are modeled availability steps, not live outage data.
          </p>
          <div className="space-y-4">
            <ChoiceGroup
              legend="Power availability"
              value={String(power)}
              options={[
                { value: "100", label: "100" },
                { value: "75", label: "75" },
                { value: "50", label: "50" },
                { value: "25", label: "25" },
                { value: "0", label: "0" },
              ]}
              onChange={(value) => {
                setUseCustom(true);
                setPower(Number(value) as PowerPct);
              }}
            />
            <ChoiceGroup
              legend="Road access"
              value={String(road)}
              options={[
                { value: "100", label: "100" },
                { value: "75", label: "75" },
                { value: "50", label: "50" },
              ]}
              onChange={(value) => {
                setUseCustom(true);
                setRoad(Number(value) as RoadPct);
              }}
            />
            <ChoiceGroup
              legend="Transport"
              value={transport}
              options={[
                { value: "unchanged", label: "Unchanged" },
                { value: "limited", label: "Limited" },
                { value: "none", label: "None" },
              ]}
              onChange={(value) => {
                setUseCustom(true);
                setTransport(value);
              }}
            />
          </div>
        </Card>

        <Button onClick={() => void runSimulate()} disabled={busy !== "idle"}>
          {busy === "run" ? <Spinner label="Simulating…" /> : "Run modeled scenario"}
        </Button>

        {result ? (
          <Card eyebrow="MODELLED SCENARIO" title={result.scenario.label}>
            <p>{result.scenario.disclaimer}</p>
            <p className="mt-2 text-foreground">
              Disruption: {LEVEL_LABEL[result.disruptionLevel]} (ordinal, not a
              percentage)
            </p>
            <p className="mt-2 text-foreground">
              First break:{" "}
              {result.firstBreak
                ? `${result.firstBreak.label} · ${LEVEL_LABEL[result.firstBreak.level]} · ${
                    result.firstBreak.source === "user_reported"
                      ? "user reported"
                      : "modeled"
                  }`
                : "None in this modeled run"}
            </p>
            <div className="mt-3">
              <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted">
                Cascade path
              </p>
              <CascadeView result={result} />
            </div>
            {webgl ? (
              <div className="mt-3">
                <DependencyMountain result={result} />
              </div>
            ) : null}
            <p className="mt-3 text-xs">{result.provenanceNote}</p>
            <ul className="mt-2 list-disc space-y-1 pl-4 text-xs">
              {result.assumptions.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </Card>
        ) : null}

        {searchNote ? (
          <p role="status" className="text-xs leading-relaxed text-muted">
            {searchNote}
          </p>
        ) : null}

        <div className="flex flex-col gap-2">
          <Button
            variant="secondary"
            onClick={() => void runSearch("min")}
            disabled={busy !== "idle"}
          >
            {busy === "min" ? (
              <Spinner label="Searching…" />
            ) : (
              "Find minimum breakdown"
            )}
          </Button>
          <Button
            variant="secondary"
            onClick={() => void runSearch("worst")}
            disabled={busy !== "idle"}
          >
            {busy === "worst" ? (
              <Spinner label="Searching…" />
            ) : (
              "Find worst case"
            )}
          </Button>
          <p className="text-[11px] leading-relaxed text-muted">
            Within modeled bounds, not a real-world prediction.
          </p>
        </div>

        {result ? (
          <Button
            variant="secondary"
            onClick={() => void runFortify()}
            disabled={busy !== "idle"}
          >
            {busy === "fortify" ? <Spinner label="Fortifying…" /> : "Fortify this plan"}
          </Button>
        ) : null}

        {fortifyError ? (
          <p className="text-xs leading-relaxed text-danger">{fortifyError}</p>
        ) : null}

        {fortify ? (
          <Card eyebrow="Fortify" title="Selected actions">
            <p className="mb-2 text-xs">
              Official / hard stay first. Cost class units, not contractor
              prices.
            </p>
            <ul className="space-y-2">
              {fortify.map((action) => (
                <li key={action.id} className="text-sm text-foreground">
                  {action.title}
                  <span className="block text-xs text-muted">
                    {action.hardConstraint || action.official
                      ? "Official/hard"
                      : "Discretionary"}
                    {" · "}
                    {action.costClass
                      ? formatCostClass(action.costClass)
                      : `Cost class ${labelForCostUnits(action.estimatedCostUnits ?? null)}`}
                  </span>
                </li>
              ))}
            </ul>
          </Card>
        ) : null}

        {home.hasBackupPower === false && result && household ? (
          <Card title="What if I had backup power?">
            <p className="mb-3 text-xs">
              Counterfactual only because backup power is confirmed absent.
              Unknown would not run this comparison.
            </p>
            <Button variant="secondary" onClick={runCounterfactual}>
              Simulate backup power
            </Button>
            {counterfactual ? (
              <p className="mt-3 text-sm text-foreground">
                Modeled disruption without backup:{" "}
                {LEVEL_LABEL[counterfactual.without]}. With backup:{" "}
                {LEVEL_LABEL[counterfactual.withChange]}. Simulated, not a
                forecast.
              </p>
            ) : null}
          </Card>
        ) : null}

        <details className="rounded-3xl border border-border bg-surface px-4 py-3">
          <summary className="cursor-pointer text-sm font-semibold text-foreground">
            How it works
          </summary>
          <ul className="mt-2 list-disc space-y-2 pl-4 text-sm leading-relaxed text-muted">
            {HOW_IT_WORKS.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </details>
      </div>
    </main>
  );
}

function detectWebGL(): boolean {
  try {
    const canvas = document.createElement("canvas");
    return Boolean(
      canvas.getContext("webgl") || canvas.getContext("experimental-webgl"),
    );
  } catch {
    return false;
  }
}

function usableHazards(hazards: HazardState): boolean {
  if (hazards.allClear !== true && hazards.allClear !== false) return false;
  if (hazards.allClear === false && hazards.hazards.length === 0) return false;
  return typeof hazards.observedAt === "string" && hazards.observedAt !== "";
}
