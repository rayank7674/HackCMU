"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Spinner } from "@/components/stormready/query-state";
import { UnavailableNote } from "@/components/stormready/unavailable-note";
import type { ExplainTask } from "@/lib/ai/types";

const TASK_LABELS: Record<ExplainTask, string> = {
  top_priority: "Why this is first",
  fits_constraints: "What fits the constraints",
  plan_changed: "Why the plan changed",
  stress_changed: "Why the stress result changed",
  combination_broke: "Why this combination broke",
};

type AskState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ok"; explanation: string; disclaimer: string }
  | { status: "unavailable"; message: string };

export function AskStormReady({
  task,
  input,
}: {
  task: ExplainTask;
  input: Record<string, unknown>;
}) {
  const [state, setState] = useState<AskState>({ status: "idle" });

  async function onAsk() {
    setState({ status: "loading" });
    try {
      const response = await fetch("/api/explain", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ task, input }),
      });
      const body: unknown = await response.json().catch(() => null);
      if (
        body &&
        typeof body === "object" &&
        "ok" in body &&
        body.ok === true &&
        "explanation" in body &&
        typeof body.explanation === "string"
      ) {
        const disclaimer =
          "disclaimer" in body && typeof body.disclaimer === "string"
            ? body.disclaimer
            : "";
        setState({
          status: "ok",
          explanation: body.explanation,
          disclaimer,
        });
        return;
      }
      const message =
        body &&
        typeof body === "object" &&
        "message" in body &&
        typeof body.message === "string"
          ? body.message
          : "Ask StormReady is unavailable. StormReady will not invent an explanation.";
      setState({ status: "unavailable", message });
    } catch {
      setState({
        status: "unavailable",
        message:
          "Ask StormReady could not be reached. StormReady will not invent an explanation.",
      });
    }
  }

  return (
    <Card eyebrow="Ask StormReady" title={TASK_LABELS[task]}>
      <p className="mb-3">
        Grok will restate the structured JSON only. It does not write safety
        policy, alerts, or an all-clear.
      </p>
      <Button
        variant="secondary"
        onClick={() => void onAsk()}
        disabled={state.status === "loading"}
      >
        {state.status === "loading" ? "Asking…" : "Ask StormReady"}
      </Button>
      {state.status === "loading" ? (
        <div className="mt-3">
          <Spinner label="Explaining from structured JSON" />
        </div>
      ) : null}
      {state.status === "ok" ? (
        <div className="mt-3 space-y-2 text-foreground">
          <p>{state.explanation}</p>
          {state.disclaimer ? (
            <p className="text-xs text-muted">{state.disclaimer}</p>
          ) : null}
        </div>
      ) : null}
      {state.status === "unavailable" ? (
        <div className="mt-3">
          <UnavailableNote title="Explanation unavailable">
            {state.message}
          </UnavailableNote>
        </div>
      ) : null}
    </Card>
  );
}
