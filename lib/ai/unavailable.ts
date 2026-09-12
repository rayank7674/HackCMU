import type { AiService, AiUnavailable, AiUnavailableReason } from "./types";

export type { AiUnavailable, AiUnavailableReason, AiService };

export function aiUnavailable(
  service: AiService,
  reason: AiUnavailableReason,
  message: string,
): AiUnavailable {
  return {
    ok: false,
    status: "unavailable",
    reason,
    message,
    service,
    inventedPolicy: false,
  };
}

export function httpStatusForAi(result: AiUnavailable): number {
  switch (result.reason) {
    case "invalid_input":
    case "missing_structured_json":
      return 400;
    case "xai_not_configured":
    case "k2_not_configured":
    case "elevenlabs_not_configured":
    case "upstream_unavailable":
    case "upstream_error":
    case "empty_model_output":
    case "ungrounded_output":
      return 503;
  }
}
