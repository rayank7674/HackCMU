import kit from "@/data/preparedness/kit.json";
import pets from "@/data/preparedness/pets.json";
import plan from "@/data/preparedness/plan.json";
import power from "@/data/preparedness/power.json";
import water from "@/data/preparedness/water.json";
import type { PreparednessDocument } from "./types";

const RAW = [kit, plan, water, power, pets] as const;

function asDocument(value: (typeof RAW)[number]): PreparednessDocument {
  return {
    id: value.id,
    title: value.title,
    source: value.source,
    sourceUrl: value.sourceUrl,
    role: "data",
    notInstructions: true,
    excerpt: value.excerpt,
  };
}

export function loadPreparednessDocuments(): PreparednessDocument[] {
  return RAW.map(asDocument);
}

export function documentById(id: string): PreparednessDocument | null {
  return loadPreparednessDocuments().find((doc) => doc.id === id) ?? null;
}
