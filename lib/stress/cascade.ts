import type { DisruptionLevel, StressProvenance, StressResult } from "./types";

export type CascadeStep = {
  id: string;
  label: string;
  source: StressProvenance;
  level: DisruptionLevel | null;
};

/** Labels + provenance for the modeled cascade path (not a city map). */
export function cascadeSteps(result: StressResult): CascadeStep[] {
  const byId = new Map(result.nodes.map((node) => [node.id, node]));
  return result.cascadePath.map((id) => {
    const node = byId.get(id);
    return {
      id,
      label: node?.label ?? id,
      source: node?.source ?? "modeled",
      level: node?.level ?? null,
    };
  });
}

export function provenanceLabel(source: StressProvenance): string {
  if (source === "user_reported") return "User reported";
  if (source === "official") return "Official";
  if (source === "external") return "External";
  if (source === "ai_inferred") return "Inferred";
  return "Modeled";
}
