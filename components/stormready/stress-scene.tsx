"use client";

import { Component, useEffect, useMemo, useState, type ReactNode } from "react";
import dynamic from "next/dynamic";
import { StressCascade } from "@/components/stormready/stress-cascade";
import { STRESS_SCENE_DISCLAIMER, STRESS_WEBGL_FALLBACK } from "@/lib/stress/copy";
import { buildStressScene, canUseWebGL, type StressSceneModel } from "@/lib/stress/scene";
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
}: {
  result: StressResult;
  edges: Pick<DependencyEdge, "from" | "to">[];
}) {
  const [webgl, setWebgl] = useState<boolean | null>(null);
  const model: StressSceneModel = useMemo(
    () => buildStressScene(result, { edges }),
    [edges, result],
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
          <span className="inline-block h-2.5 w-2.5 rounded-full bg-danger" aria-hidden />
          Fails in this model
        </li>
        <li className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-full bg-warning" aria-hidden />
          Strained
        </li>
        <li className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-full bg-muted" aria-hidden />
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
        </div>
      )}
    </div>
  );
}
