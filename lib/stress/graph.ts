import { isKnown, isUnknown } from "@/types";
import type { HomeProfile, HouseholdProfile } from "@/types";
import type {
  DependencyEdge,
  DependencyGraph,
  DependencyNode,
  DependencyNodeType,
  StressProvenance,
  StressScenario,
} from "./types";

function node(
  id: string,
  type: DependencyNodeType,
  label: string,
  source: StressProvenance,
  ownCapacity: number,
): DependencyNode {
  return { id, type, label, source, ownCapacity };
}

function edge(
  from: string,
  to: string,
  strength: number,
  rationale: string,
  source: StressProvenance = "modeled",
): DependencyEdge {
  return { from, to, strength, rationale, source };
}

function transportBase(household: HouseholdProfile): {
  capacity: number;
  assumption: string | null;
} {
  if (household.vehicleCount === 0) {
    return {
      capacity: 40,
      assumption:
        "User reported zero vehicles. Modeled transport capacity starts limited.",
    };
  }
  if (household.canSelfEvacuate === false) {
    return {
      capacity: 55,
      assumption:
        "User reported they cannot self-evacuate. Modeled transport capacity starts limited.",
    };
  }
  if (isUnknown(household.vehicleCount) && isUnknown(household.canSelfEvacuate)) {
    return {
      capacity: 100,
      assumption:
        "Vehicle count and self-evacuation are unknown. Unknown is not treated as no car.",
    };
  }
  if (isKnown(household.vehicleCount) && household.vehicleCount > 0) {
    return { capacity: 100, assumption: null };
  }
  return {
    capacity: 100,
    assumption:
      "Transport details are incomplete. Capacity is left at baseline rather than assuming none.",
  };
}

function usesElevator(home: HomeProfile): boolean {
  if (home.dwellingType !== "apartment") return false;
  return isKnown(home.stories) && home.stories >= 5;
}

/**
 * Household-only modeled graph. Edges are modeled unless the capacity
 * fact itself is user-reported. Unknown backup power does not add a
 * "no generator" charging failure path.
 */
export type GraphBuildOptions = {
  includeLocalFeeder?: boolean;
};

export function scenarioIncludesLocalFeeder(scenario: StressScenario): boolean {
  return scenario.powerAvailability < 100 || scenario.outageHours !== null;
}

function roofCapacity(home: HomeProfile): { capacity: number; source: StressProvenance; note: string } {
  if (isUnknown(home.roofAgeYears)) {
    return {
      capacity: 65,
      source: "modeled",
      note: "Roof age is unknown. Unknown is not treated as a new roof.",
    };
  }
  if (isKnown(home.roofAgeYears) && home.roofAgeYears >= 15) {
    return {
      capacity: 55,
      source: "user_reported",
      note: `User-reported roof age ${home.roofAgeYears} years is in the older-roof class.`,
    };
  }
  return {
    capacity: 90,
    source: "user_reported",
    note: "User-reported roof age is not in the older-roof class.",
  };
}

function openingsCapacity(home: HomeProfile): {
  capacity: number;
  source: StressProvenance;
  note: string;
} {
  if (home.hasHurricaneShutters === false) {
    return {
      capacity: 60,
      source: "user_reported",
      note: "User reported no hurricane shutters. Openings are modeled as a wind weak point.",
    };
  }
  if (home.hasHurricaneShutters === true) {
    return {
      capacity: 90,
      source: "user_reported",
      note: "User reported hurricane shutters.",
    };
  }
  return {
    capacity: 75,
    source: "modeled",
    note: "Shutter status is unknown. Unknown is not treated as protected openings.",
  };
}

function lowestFloorCapacity(home: HomeProfile): {
  capacity: number;
  source: StressProvenance;
  note: string;
} {
  const zone = isKnown(home.floodZone) ? home.floodZone.toUpperCase() : null;
  const floodLetter = zone && /^[AV]/.test(zone);
  if (home.hasBasement === true && floodLetter) {
    return {
      capacity: 40,
      source: "external",
      note: "Basement plus a FEMA A/V flood zone - lowest floor is modeled as flood-sensitive.",
    };
  }
  if (home.hasBasement === true && isUnknown(home.floodZone)) {
    return {
      capacity: 55,
      source: "modeled",
      note: "Basement present and flood zone unknown. Unknown is not 'outside a flood zone'.",
    };
  }
  if (floodLetter) {
    return {
      capacity: 60,
      source: "external",
      note: "FEMA A/V flood zone - lowest floor is modeled as flood-sensitive.",
    };
  }
  return {
    capacity: 85,
    source: isUnknown(home.floodZone) ? "modeled" : "user_reported",
    note: "Lowest floor starts at baseline. This is not an all-clear for flooding.",
  };
}

function pipesCapacity(home: HomeProfile): { capacity: number; source: StressProvenance; note: string } {
  if (home.hasWellWater === true || home.hasSeptic === true) {
    return {
      capacity: 70,
      source: "user_reported",
      note: "Well or septic is modeled as more freeze-sensitive than municipal service.",
    };
  }
  return {
    capacity: 90,
    source: "modeled",
    note: "Pipes are modeled as a freeze path. This is not a plumbing inspection.",
  };
}

export function buildHouseholdGraph(
  home: HomeProfile,
  household: HouseholdProfile,
  options: GraphBuildOptions = {},
): DependencyGraph {
  const assumptions: string[] = [
    "This graph is a household planning model, not official infrastructure topology.",
    "Results are simulated under stated assumptions, not forecasts.",
  ];

  const transport = transportBase(household);
  if (transport.assumption) assumptions.push(transport.assumption);

  const nodes: DependencyNode[] = [
    node("home", "home", "Home", "user_reported", 100),
    node("power", "power", "Grid power", "modeled", 100),
    node("water", "water", "Water service", "modeled", 100),
    node("road", "road", "Nearby road access", "modeled", 100),
    node(
      "transport",
      "transport",
      "Household transportation",
      household.vehicleCount === 0 || household.canSelfEvacuate === false
        ? "user_reported"
        : "modeled",
      transport.capacity,
    ),
    node("mobility", "mobility", "Household mobility", "modeled", 100),
    node("communication", "communication", "Phones and information", "modeled", 100),
    node("food", "food", "Food and pharmacy access", "modeled", 100),
    node("healthcare", "healthcare", "Healthcare access", "modeled", 100),
    node("shelter", "shelter", "Staying in place", "modeled", 100),
  ];

  const edges: DependencyEdge[] = [
    edge(
      "road",
      "transport",
      1,
      "Modeled: personal travel uses nearby road access.",
    ),
    edge(
      "transport",
      "mobility",
      1,
      "Modeled: leaving the home depends on a transportation option.",
    ),
    edge(
      "transport",
      "food",
      0.9,
      "Modeled: grocery and pharmacy trips usually need transport or road access.",
    ),
    edge(
      "transport",
      "healthcare",
      0.9,
      "Modeled: reaching clinics depends on transport when care is not at home.",
    ),
    edge("home", "shelter", 1, "Modeled: sheltering in place uses this home."),
    edge(
      "water",
      "shelter",
      0.7,
      "Modeled: staying in place is harder without water service.",
    ),
  ];

  if (home.hasBackupPower === false) {
    assumptions.push(
      "User reported no backup power. Device charging is modeled as depending on grid power.",
    );
    nodes.push(
      node(
        "charging",
        "charging",
        "Device charging",
        "user_reported",
        100,
      ),
    );
    edges.push(
      edge(
        "power",
        "charging",
        1,
        "User reported no backup power, so charging is modeled as grid-dependent.",
        "modeled",
      ),
      edge(
        "charging",
        "communication",
        1,
        "Modeled: phones and radios need a way to recharge during a long outage.",
      ),
    );
  } else if (home.hasBackupPower === true) {
    assumptions.push(
      "User reported backup power. Communication is not modeled as failing from grid loss alone.",
    );
  } else {
    assumptions.push(
      "Backup power is unknown. Unknown is not treated as no generator, so charging is not modeled as a grid-only failure.",
    );
  }

  if (usesElevator(home)) {
    assumptions.push(
      `User-reported apartment with ${home.stories} stories. Elevator access is modeled as depending on building power.`,
    );
    nodes.push(
      node("elevator", "elevator", "Building elevator", "modeled", 100),
    );
    edges.push(
      edge(
        "power",
        "elevator",
        1,
        "Modeled: typical apartment elevators need building power.",
      ),
      edge(
        "elevator",
        "mobility",
        1,
        "Modeled: upper-floor apartments often need the elevator to leave.",
      ),
    );
  }

  if (household.hasMobilityNeeds === true) {
    assumptions.push(
      "User reported mobility needs. Healthcare access is modeled as more sensitive to mobility loss.",
    );
    edges.push(
      edge(
        "mobility",
        "healthcare",
        1,
        "User-reported mobility needs: reaching care is modeled as mobility-dependent.",
      ),
    );
  }

  if (household.hasPowerDependentMedicalDevice === true) {
    assumptions.push(
      "User reported a power-dependent medical device. Healthcare-at-home is modeled as grid-sensitive.",
    );
    edges.push(
      edge(
        "power",
        "healthcare",
        1,
        "User-reported power-dependent medical device.",
      ),
    );
  }

  const roof = roofCapacity(home);
  const openings = openingsCapacity(home);
  const lowest = lowestFloorCapacity(home);
  const pipes = pipesCapacity(home);
  assumptions.push(roof.note, openings.note, lowest.note, pipes.note);
  nodes.push(
    node("roof", "roof", "Roof", roof.source, roof.capacity),
    node("openings", "openings", "Windows and openings", openings.source, openings.capacity),
    node("lowest_floor", "lowest_floor", "Lowest floor", lowest.source, lowest.capacity),
    node("pipes", "pipes", "Pipes", pipes.source, pipes.capacity),
  );

  if (options.includeLocalFeeder) {
    assumptions.push(
      "Modeled local supply - not a real utility map or a found faulty line.",
    );
    nodes.push(
      node(
        "local_feeder",
        "local_feeder",
        "Modeled local supply",
        "modeled",
        100,
      ),
    );
    edges.push(
      edge(
        "local_feeder",
        "power",
        1,
        "Modeled local supply - not a real utility map or a found faulty line.",
      ),
    );
  }

  if (home.hasWellWater === true) {
    assumptions.push(
      "User reported well water. Water service is modeled as depending on power for pumping.",
    );
    edges.push(
      edge(
        "power",
        "water",
        1,
        "User-reported well: pumping is modeled as power-dependent.",
      ),
    );
  }

  return { nodes, edges, assumptions };
}
