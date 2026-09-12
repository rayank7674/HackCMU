"use client";

import { Component, useEffect, useMemo, useState, type ReactNode } from "react";
import dynamic from "next/dynamic";
import { StressCascade } from "@/components/stormready/stress-cascade";
import { STRESS_SCENE_DISCLAIMER, STRESS_WEBGL_FALLBACK } from "@/lib/stress/copy";
import { buildStressScene, canUseWebGL, type StressSceneModel } from "@/lib/stress/scene";

const HOUSE_PART_IDS = new Set(["roof", "openings", "lowest_floor", "pipes"]);
import type { HomeProfile } from "@/lib/stormready";
import type { DependencyEdge, NodeState, StressResult } from "@/lib/stress";

const StressSceneCanvas = dynamic(
  () => import("./stress-scene-canvas").then((mod) => mod.StressSceneCanvas),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full items-center justify-center px-3 text-center text-xs text-muted">
        Loading modeled 3D view…
      </div>
    ),
  },
);

class SceneErrorBoundary extends Component<
  { fallback: ReactNode; children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    if (this.state.failed) return this.props.fallback;
    return this.props.children;
  }
}

function CascadeFallback({
  nodes,
  edges,
  cascadePath,
  reason,
}: {
  nodes: NodeState[];
  edges: Pick<DependencyEdge, "from" | "to">[];
  cascadePath: string[];
  reason: string;
}) {
  return (
    <div>
      <p className="mb-2 text-xs leading-relaxed text-muted">{reason}</p>
      <StressCascade nodes={nodes} edges={edges} cascadePath={cascadePath} />
    </div>
  );
}

export function StressScene({
  result,
  edges,
  home = null,
}: {
  result: StressResult;
  edges: Pick<DependencyEdge, "from" | "to">[];
  home?: HomeProfile | null;
}) {
  const [webgl, setWebgl] = useState<boolean | null>(null);
  const model: StressSceneModel = useMemo(
    () => buildStressScene(result, { edges }, home),
    [edges, home, result],
  );

  useEffect(() => {
    setWebgl(canUseWebGL());
  }, []);

  const fallback = (
    <CascadeFallback
      nodes={result.nodes}
      edges={edges}
      cascadePath={result.cascadePath}
      reason={STRESS_WEBGL_FALLBACK}
    />
  );

  return (
    <div>
      <p className="mb-2 text-xs leading-relaxed">{STRESS_SCENE_DISCLAIMER}</p>
      <ul className="mb-2 flex flex-wrap gap-3 text-[11px] text-muted" aria-label="Modeled colors">
        <li className="flex items-center gap-1.5">
          <span
            className="inline-block h-2.5 w-2.5 rounded-full"
            style={{ background: "#b42318" }}
            aria-hidden
          />
          Fails in this model
        </li>
        <li className="flex items-center gap-1.5">
          <span
            className="inline-block h-2.5 w-2.5 rounded-full"
            style={{ background: "#c4a15a" }}
            aria-hidden
          />
          Strained
        </li>
        <li className="flex items-center gap-1.5">
          <span
            className="inline-block h-2.5 w-2.5 rounded-full"
            style={{ background: "#7a8ea3" }}
            aria-hidden
          />
          Holding up
        </li>
      </ul>
      {webgl === false ? (
        fallback
      ) : (
        <div className="sr-stress-scene">
          {webgl === null ? (
            <div className="flex h-full items-center justify-center text-xs text-muted">
              Checking 3D support…
            </div>
          ) : (
            <SceneErrorBoundary fallback={fallback}>
              <StressSceneCanvas model={model} />
            </SceneErrorBoundary>
          )}
          <ul className="sr-stress-compass" aria-hidden>
            <li data-dir="n">N</li>
            <li data-dir="s">S</li>
          </ul>
          <ul className="sr-stress-chips" aria-label="Modeled household systems">
            {model.nodes
              .filter((node) => node.id !== "home" && !HOUSE_PART_IDS.has(node.id))
              .map((node) => (
                <li key={node.id} className={node.failed ? "is-failed" : undefined}>
                  <span style={{ background: node.color }} aria-hidden />
                  {node.shortLabel}
                </li>
              ))}
          </ul>
        </div>
      )}
      {webgl !== false ? (
        <ul className="mt-3 space-y-1 text-xs text-muted" aria-label="Modeled house parts">
          {model.houseParts
            .filter((part) => part.level !== "none")
            .map((part) => (
              <li key={part.id}>{part.why}</li>
            ))}
        </ul>
      ) : null}
    </div>
  );
}
