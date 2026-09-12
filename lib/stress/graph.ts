import { isKnown, isUnknown } from "@/types";
import type { HomeProfile, HouseholdProfile } from "@/types";
import type {
  DependencyEdge,
  DependencyGraph,
  DependencyNode,
  DependencyNodeType,
  StressProvenance,
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
export function buildHouseholdGraph(
  home: HomeProfile,
  household: HouseholdProfile,
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
