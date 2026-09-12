"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Spinner } from "@/components/stormready/query-state";
import { UnavailableNote } from "@/components/stormready/unavailable-note";
import type { InferredFact } from "@/lib/ai/types";

type PanelState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ok"; facts: InferredFact[]; disclaimer: string }
  | { status: "unavailable"; message: string };

export function EvidencePanel({
  facts,
  disclaimer,
}: {
  facts?: InferredFact[];
  disclaimer?: string;
}) {
  const [state, setState] = useState<PanelState>(
    facts && facts.length > 0
      ? {
          status: "ok",
          facts,
          disclaimer:
            disclaimer ??
            "These claims are ai_inferred. They are not official alerts or StormReady rules.",
        }
      : { status: "idle" },
  );

  async function onInspect() {
    setState({ status: "loading" });
    try {
      const response = await fetch("/api/explain/inspect", { method: "POST" });
      const body: unknown = await response.json().catch(() => null);
      if (
        body &&
        typeof body === "object" &&
        "ok" in body &&
        body.ok === true &&
        "facts" in body &&
        Array.isArray(body.facts)
      ) {
        const nextFacts = body.facts.filter(isInferredFact);
        const nextDisclaimer =
          "disclaimer" in body && typeof body.disclaimer === "string"
            ? body.disclaimer
            : "These claims are ai_inferred. They are not official alerts or StormReady rules.";
        setState({
          status: "ok",
          facts: nextFacts,
          disclaimer: nextDisclaimer,
        });
        return;
      }
      const message =
        body &&
        typeof body === "object" &&
        "message" in body &&
        typeof body.message === "string"
          ? body.message
          : "Document inspection is unavailable. StormReady will not invent facts, rules, or alerts.";
      setState({ status: "unavailable", message });
    } catch {
      setState({
        status: "unavailable",
        message:
          "Document inspection could not be reached. StormReady will not invent facts.",
      });
    }
  }

  return (
    <Card eyebrow="Evidence" title="Preparedness notes (ai_inferred)">
      <p className="mb-3">
        K2 inspects bundled public-guidance paraphrases as data. It does not
        write rules or live alerts.
      </p>
      <Button
        variant="secondary"
        onClick={() => void onInspect()}
        disabled={state.status === "loading"}
      >
        {state.status === "loading" ? "Inspecting…" : "Inspect bundled notes"}
      </Button>
      {state.status === "loading" ? (
        <div className="mt-3">
          <Spinner label="Inspecting bundled preparedness excerpts" />
        </div>
      ) : null}
      {state.status === "ok" ? (
        <ul className="mt-3 space-y-3">
          {state.facts.length === 0 ? (
            <li>No inferred facts were returned.</li>
          ) : (
            state.facts.map((fact) => (
              <li key={fact.id} className="text-foreground">
                <p>{fact.claim}</p>
                <p className="mt-1 text-xs text-muted">
                  {fact.provenance} · {fact.source} · not official · not a forecast
                </p>
              </li>
            ))
          )}
        </ul>
      ) : null}
      {state.status === "ok" && state.disclaimer ? (
        <p className="mt-3 text-xs text-muted">{state.disclaimer}</p>
      ) : null}
      {state.status === "unavailable" ? (
        <div className="mt-3">
          <UnavailableNote title="Inspection unavailable">
            {state.message}
          </UnavailableNote>
        </div>
      ) : null}
    </Card>
  );
}

function isInferredFact(value: unknown): value is InferredFact {
  if (!value || typeof value !== "object") return false;
  const fact = value as Partial<InferredFact>;
  return (
    typeof fact.id === "string" &&
    typeof fact.claim === "string" &&
    fact.provenance === "ai_inferred" &&
    fact.official === false
  );
}
