/**
 * Map plan action categories to existing official Help links.
 * At most two links. Never invent contractors or eligibility.
 */

import type { RecommendationCategory } from "@/lib/stormready";
import {
  LOCAL_HELP_LINKS,
  PREPAREDNESS_LINKS,
  type OfficialLink,
} from "@/lib/help/content";

export const MAX_CATEGORY_LINKS = 2;

const ALL_OFFICIAL_LINKS: OfficialLink[] = [
  ...PREPAREDNESS_LINKS,
  ...LOCAL_HELP_LINKS,
];

const BY_ID = new Map(ALL_OFFICIAL_LINKS.map((link) => [link.id, link]));

/**
 * Existing link ids only. Evacuate/shelter use Ready.gov alerts plus
 * national local-help (211 / Red Cross), not Tampa-only examples.
 */
const CATEGORY_LINK_IDS: Record<
  RecommendationCategory,
  readonly string[]
> = {
  evacuate: ["ready-alerts", "211"],
  shelter: ["red-cross", "ready-alerts"],
  supplies: ["ready-gov"],
  medical: ["211"],
  pets: ["red-cross", "ready-gov"],
  power: ["ready-gov", "fema"],
  water: ["ready-gov", "fema"],
  communication: ["ready-gov", "weather-gov"],
  documents: ["ready-gov", "fema"],
  other: ["ready-gov"],
};

function requireLink(id: string): OfficialLink {
  const link = BY_ID.get(id);
  if (!link) {
    throw new Error(`Unknown official Help link id: ${id}`);
  }
  return link;
}

export function linksForCategory(
  category: RecommendationCategory,
): OfficialLink[] {
  const ids = CATEGORY_LINK_IDS[category] ?? CATEGORY_LINK_IDS.other;
  return ids.slice(0, MAX_CATEGORY_LINKS).map(requireLink);
}
