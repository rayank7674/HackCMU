export const INTEGRATION_TIMEOUT_MS = 8_000;

export type FetchJsonOk = {
  ok: true;
  status: number;
  data: unknown;
};

export type FetchJsonErr = {
  ok: false;
  status: number | null;
  error: string;
  timedOut: boolean;
};

export type FetchJsonResult = FetchJsonOk | FetchJsonErr;

export async function fetchJson(
  url: string,
  init: RequestInit & { timeoutMs?: number } = {},
): Promise<FetchJsonResult> {
  const { timeoutMs, ...requestInit } = init;
  try {
    const response = await fetch(url, {
      ...requestInit,
      cache: "no-store",
      signal:
        requestInit.signal ??
        AbortSignal.timeout(timeoutMs ?? INTEGRATION_TIMEOUT_MS),
    });

    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        error: `HTTP ${response.status}`,
        timedOut: false,
      };
    }

    try {
      const data: unknown = await response.json();
      return { ok: true, status: response.status, data };
    } catch {
      return {
        ok: false,
        status: response.status,
        error: "Response was not JSON",
        timedOut: false,
      };
    }
  } catch (error) {
    const timedOut = isTimeoutError(error);
    const message = timedOut
      ? "Request timed out"
      : error instanceof Error
        ? error.message
        : "Request failed";
    return { ok: false, status: null, error: message, timedOut };
  }
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function readString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

export function readNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function isTimeoutError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  return error.name === "TimeoutError" || error.name === "AbortError";
}
