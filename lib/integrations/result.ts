import { UNKNOWN, type HazardState, type Unknownable } from "@/lib/stormready";

/**
 * Shared fail-closed result for geocode / NWS adapters.
 * Callers must treat `status: "unavailable"` as unknown - never invent
 * coordinates, alerts, or an all-clear.
 */
export type IntegrationService = "geocode" | "nws" | "osm";

export type IntegrationUnavailableReason =
  | "invalid_input"
  | "no_match"
  | "upstream_unavailable"
  | "upstream_error";

export type IntegrationUnavailable = {
  ok: false;
  status: "unavailable";
  reason: IntegrationUnavailableReason;
  message: string;
  service: IntegrationService;
};

export function unavailable(
  service: IntegrationService,
  reason: IntegrationUnavailableReason,
  message: string,
): IntegrationUnavailable {
  return {
    ok: false,
    status: "unavailable",
    reason,
    message,
    service,
  };
}

export function unknownHazardState(
  locationLabel: Unknownable<string> = UNKNOWN,
  observedAt: string = new Date().toISOString(),
): HazardState {
  return {
    observedAt,
    locationLabel,
    hazards: [],
    allClear: UNKNOWN,
    provenance: UNKNOWN,
  };
}

export function httpStatusForUnavailable(
  result: IntegrationUnavailable,
): number {
  switch (result.reason) {
    case "invalid_input":
      return 400;
    case "no_match":
      return 404;
    case "upstream_unavailable":
    case "upstream_error":
      return 503;
  }
}
