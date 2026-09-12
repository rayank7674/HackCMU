"use client";

import { useCallback, useState } from "react";
import { Card } from "@/components/ui/card";

type K2ExtractedItem = {
  dependency: string;
  statement: string;
  source: string;
  confidence: number;
  sourceType: "ai_inferred";
};

type LoadState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "unavailable"; message: string }
  | { status: "ok"; items: K2ExtractedItem[] };

/**
 * Collapsed display of K2 document extracts. Safe to mount later from
 * `/stress`. Display only — does not mutate `lib/stress/graph.ts`,
 * NWS alerts, or knapsack constraints.
 */
export function EvidencePanel() {
  const [open, setOpen] = useState(false);
  const [load, setLoad] = useState<LoadState>({ status: "idle" });

  const onToggle = useCallback(async (nextOpen: boolean) => {
    setOpen(nextOpen);
    if (!nextOpen) return;
    if (load.status === "ok" || load.status === "loading") return;

    setLoad({ status: "loading" });
    try {
      const response = await fetch("/api/ai/k2", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
        cache: "no-store",
      });
      const body: unknown = await response.json().catch(() => null);
      if (
        body &&
        typeof body === "object" &&
        "ok" in body &&
        body.ok === true &&
        "items" in body &&
        Array.isArray(body.items)
      ) {
        setLoad({
          status: "ok",
          items: body.items.filter(isExtractItem),
        });
        return;
      }
      const message =
        body &&
        typeof body === "object" &&
        "message" in body &&
        typeof body.message === "string"
          ? body.message
          : "K2 extract is unavailable.";
      setLoad({ status: "unavailable", message });
    } catch {
      setLoad({
        status: "unavailable",
        message: "K2 extract is unavailable.",
      });
    }
  }, [load.status]);

  return (
    <Card
      eyebrow="AI inferred"
      title="Documented dependencies (AI inferred)"
    >
      <p className="text-sm leading-relaxed text-muted">
        Notes from public preparedness documents. Not official NWS alerts.
        They do not change plan constraints or the modeled stress graph.
      </p>
      <details
        className="mt-3"
        open={open}
        onToggle={(event) => {
          const next = event.currentTarget.open;
          void onToggle(next);
        }}
      >
        <summary className="cursor-pointer text-sm font-semibold text-foreground">
          {open ? "Hide documented dependencies" : "Show documented dependencies"}
        </summary>
        <div className="mt-3">
          {load.status === "loading" || load.status === "idle" ? (
            <p className="text-sm text-muted">Loading inferred notes…</p>
          ) : null}
          {load.status === "unavailable" ? (
            <p className="text-sm text-muted">{load.message}</p>
          ) : null}
          {load.status === "ok" && load.items.length === 0 ? (
            <p className="text-sm text-muted">No inferred dependencies returned.</p>
          ) : null}
          {load.status === "ok" && load.items.length > 0 ? (
            <ul className="space-y-3">
              {load.items.map((item, index) => (
                <li
                  key={`${item.dependency}-${index}`}
                  className="border-t border-border pt-3 first:border-t-0 first:pt-0"
                >
                  <p className="text-sm font-semibold text-foreground">
                    {item.dependency}
                  </p>
                  <p className="mt-1 text-sm leading-relaxed text-muted">
                    {item.statement}
                  </p>
                  <p className="mt-1 text-[11px] font-medium uppercase tracking-[0.18em] text-muted">
                    {item.sourceType} · {item.source} ·{" "}
                    {Math.round(item.confidence * 100)}%
                  </p>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </details>
    </Card>
  );
}

function isExtractItem(value: unknown): value is K2ExtractedItem {
  if (!value || typeof value !== "object") return false;
  const item = value as Record<string, unknown>;
  return (
    typeof item.dependency === "string" &&
    typeof item.statement === "string" &&
    typeof item.source === "string" &&
    typeof item.confidence === "number" &&
    item.sourceType === "ai_inferred"
  );
}
