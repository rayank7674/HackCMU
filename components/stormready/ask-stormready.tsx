"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/stormready/query-state";
import {
  fetchExplain,
  type ExplainIntent,
  type OptimizationView,
  type ProposedStressScenario,
} from "@/lib/stormready-api";
import type { OptimizationDiff } from "@/lib/optimization";

type AskState = {
  status: "idle" | "loading" | "ready" | "unavailable";
  intent: ExplainIntent | null;
  text: string | null;
  source: "ai" | "deterministic";
};

const INITIAL_ASK: AskState = {
  status: "idle",
  intent: null,
  text: null,
  source: "deterministic",
};

export function AskStormReady({
  optimization,
  planDelta,
  officialHeadlines,
  fallbackRationale,
}: {
  optimization: OptimizationView | null;
  planDelta: OptimizationDiff | null;
  officialHeadlines: string[];
  fallbackRationale: string[];
}) {
  const [ask, setAsk] = useState<AskState>(INITIAL_ASK);

  async function run(intent: ExplainIntent) {
    setAsk({ status: "loading", intent, text: null, source: "ai" });
    const result = await fetchExplain({
      intent,
      payload: {
        optimization: optimization
          ? {
              selectedIds: optimization.selectedIds,
              hardConstraintIds: optimization.hardConstraintIds,
              candidates: optimization.candidates.map((candidate) => ({
                id: candidate.id,
                title: candidate.title,
                ruleId: candidate.ruleId,
                hardConstraint: candidate.hardConstraint,
                selected: candidate.selected,
              })),
              rejected: optimization.rejected,
              notes: optimization.notes,
            }
          : undefined,
        selectedIds: optimization?.selectedIds ?? [],
        constraints: optimization?.constraintsUsed,
        officialHeadlines,
        notes: optimization?.notes ?? [],
        planDelta,
        diff: planDelta,
      },
    });
    if (result.ok && result.text) {
      setAsk({ status: "ready", intent, text: result.text, source: "ai" });
      return;
    }
    setAsk({
      status: "unavailable",
      intent,
      text: fallbackRationale.filter(Boolean).join("\n\n") || (!result.ok ? result.message : "AI explanation is unavailable."),
      source: "deterministic",
    });
  }

  return (
    <Card eyebrow="Ask StormReady" title="Explain this plan">
      <p className="text-xs">
        Grok can explain this checklist. It cannot add, remove, or reorder
        actions, and it cannot issue evacuation orders or a safety percentage.
      </p>
      <div className="mt-3 flex flex-wrap gap-1.5">
        <Chip
          label="Why is this my top priority?"
          pressed={ask.intent === "why_top_priority"}
          disabled={ask.status === "loading" || !optimization}
          onClick={() => void run("why_top_priority")}
        />
        <Chip
          label="What can I do with my constraints?"
          pressed={ask.intent === "what_with_constraints"}
          disabled={ask.status === "loading" || !optimization}
          onClick={() => void run("what_with_constraints")}
        />
        <Chip
          label="Why did my plan change?"
          pressed={ask.intent === "why_plan_changed"}
          disabled={ask.status === "loading" || !planDelta}
          onClick={() => void run("why_plan_changed")}
        />
      </div>
      {ask.status === "loading" ? (
        <div className="mt-3">
          <Spinner label="Asking Grok…" />
        </div>
      ) : null}
      {ask.text ? (
        <ExplanationBlock source={ask.source} text={ask.text} />
      ) : null}
    </Card>
  );
}

export function StressAsk({
  selectedIds,
  cascadeNodeLabels,
  firstBreakLabel,
  disruptionLevel,
  assumptions,
  onConfirmScenario,
}: {
  selectedIds?: string[];
  cascadeNodeLabels: string[];
  firstBreakLabel: string | null;
  disruptionLevel: string | null;
  assumptions: string[];
  onConfirmScenario?: (scenario: ProposedStressScenario) => void;
}) {
  const [ask, setAsk] = useState<AskState>(INITIAL_ASK);
  const [draft, setDraft] = useState("");
  const [proposed, setProposed] = useState<ProposedStressScenario | null>(null);
  const [proposedSource, setProposedSource] = useState<"grok" | "heuristic" | null>(
    null,
  );
  const hasCombination = cascadeNodeLabels.length > 0 || disruptionLevel !== null;

  async function whyCombination() {
    setAsk({ status: "loading", intent: "why_combination", text: null, source: "ai" });
    const result = await fetchExplain({
      intent: "why_combination",
      payload: {
        selectedIds: selectedIds ?? [],
        cascadeNodeLabels,
        firstBreakLabel,
        disruptionLevel,
        assumptions,
      },
    });
    if (result.ok && result.text) {
      setAsk({
        status: "ready",
        intent: "why_combination",
        text: result.text,
        source: "ai",
      });
      return;
    }
    setAsk({
      status: "unavailable",
      intent: "why_combination",
      text: assumptions.filter(Boolean).join("\n") || (!result.ok ? result.message : "AI explanation is unavailable."),
      source: "deterministic",
    });
  }

  async function propose() {
    setAsk({ status: "loading", intent: "propose_scenario", text: null, source: "ai" });
    const result = await fetchExplain({
      intent: "propose_scenario",
      payload: { userText: draft },
    });
    if (result.proposedScenario) {
      setProposed(result.proposedScenario);
      setProposedSource(result.proposedSource);
      setAsk({
        status: result.ok ? "ready" : "unavailable",
        intent: "propose_scenario",
        text: result.ok
          ? "Confirm this modeled scenario. StormReady has not run the simulator yet."
          : "Grok is unavailable. These are mapped StressScenario fields — confirm before running.",
        source: result.ok ? "ai" : "deterministic",
      });
      return;
    }
    setAsk({
      status: "unavailable",
      intent: "propose_scenario",
      text: result.ok
        ? "AI explanation is unavailable."
        : result.message,
      source: "deterministic",
    });
  }

  return (
    <Card eyebrow="Ask StormReady" title="Stress explanation">
      <p className="text-xs">
        Modeled planning only. Grok does not invent infrastructure or run the
        simulator.
      </p>
      <div className="mt-3 flex flex-wrap gap-1.5">
        <Chip
          label="Why this combination?"
          pressed={ask.intent === "why_combination"}
          disabled={ask.status === "loading" || !hasCombination}
          onClick={() => void whyCombination()}
        />
      </div>
      <label className="mt-4 block text-xs font-semibold text-foreground">
        Propose a modeled scenario
        <textarea
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          rows={3}
          className="mt-1 w-full rounded-2xl border border-border bg-white px-3 py-2 text-sm text-foreground"
          placeholder="lose power tonight and the main road closes"
        />
      </label>
      <div className="mt-2">
        <Button
          variant="secondary"
          disabled={ask.status === "loading" || draft.trim() === ""}
          onClick={() => void propose()}
        >
          Map to scenario fields
        </Button>
      </div>
      {ask.status === "loading" ? (
        <div className="mt-3">
          <Spinner label="Asking Grok…" />
        </div>
      ) : null}
      {ask.text ? (
        <ExplanationBlock source={ask.source} text={ask.text} />
      ) : null}
      {proposed ? (
        <div
          role="region"
          aria-label="Proposed scenario to confirm"
          className="mt-3 rounded-2xl border border-accent/30 bg-surface-elevated px-3 py-3"
        >
          <p className="text-xs font-semibold text-foreground">
            Confirm modeled scenario
            {proposedSource === "heuristic" ? " · mapped fields" : " · AI-mapped fields"}
          </p>
          <p className="mt-1 text-sm text-foreground">{proposed.label}</p>
          <ul className="mt-2 space-y-1 text-xs">
            <li>Power availability: {proposed.powerAvailability}%</li>
            <li>Road access: {proposed.roadAccessibility}%</li>
            <li>Transport: {proposed.transport}</li>
            <li>Water: {proposed.waterAvailability}%</li>
            <li>Outage hours: {proposed.outageHours ?? "none"}</li>
            <li>Hazard boost: {proposed.hazardBoost ?? "none"}</li>
          </ul>
          <p className="mt-2 text-xs">{proposed.disclaimer}</p>
          {onConfirmScenario ? (
            <button
              type="button"
              className="mt-3 text-sm font-semibold text-accent-strong"
              onClick={() => onConfirmScenario(proposed)}
            >
              Confirm scenario
            </button>
          ) : (
            <p className="mt-2 text-xs">
              Confirm on the Stress tab when it is available. The simulator has
              not run.
            </p>
          )}
        </div>
      ) : null}
    </Card>
  );
}

function Chip({
  label,
  pressed,
  disabled,
  onClick,
}: {
  label: string;
  pressed: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      disabled={disabled}
      onClick={onClick}
      className={`rounded-full px-3 py-1.5 text-xs font-semibold disabled:opacity-50 ${
        pressed
          ? "bg-accent-strong text-white"
          : "bg-surface-elevated text-foreground"
      }`}
    >
      {label}
    </button>
  );
}

function ExplanationBlock({
  source,
  text,
}: {
  source: "ai" | "deterministic";
  text: string;
}) {
  return (
    <div className="mt-3 rounded-2xl bg-surface-elevated px-3 py-3">
      <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted">
        {source === "ai" ? "AI explanation" : "Deterministic rationale"}
      </p>
      <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-foreground">
        {text}
      </p>
    </div>
  );
}
