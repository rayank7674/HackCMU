import type { StormReadySnapshot } from "@/types";

export const SAVE_PLAN_PATH = "/api/save-plan";
export const LOAD_PLAN_PATH = "/api/load-plan";

export type CloudPlanFailure = {
  ok: false;
  error: string;
  message: string;
  status: number;
};

export type CloudPlanSuccess<T> = {
  ok: true;
  data: T;
  status: number;
};

export type CloudPlanResult<T> = CloudPlanSuccess<T> | CloudPlanFailure;

export async function postSavePlan(
  snapshot: StormReadySnapshot,
  init?: { headers?: HeadersInit },
): Promise<CloudPlanResult<{ userId: string; snapshot: StormReadySnapshot }>> {
  return requestJson(SAVE_PLAN_PATH, {
    method: "POST",
    body: snapshot,
    headers: init?.headers,
  });
}

export async function fetchSavedPlan(
  init?: { headers?: HeadersInit },
): Promise<CloudPlanResult<{ snapshot: StormReadySnapshot | null }>> {
  return requestJson(LOAD_PLAN_PATH, {
    method: "GET",
    headers: init?.headers,
  });
}

async function requestJson<T>(
  path: string,
  init: { method: "GET" | "POST"; body?: unknown; headers?: HeadersInit },
): Promise<CloudPlanResult<T>> {
  try {
    const response = await fetch(path, {
      method: init.method,
      headers: {
        ...(init.method === "POST"
          ? { "Content-Type": "application/json" }
          : {}),
        ...headerRecord(init.headers),
      },
      body: init.method === "POST" ? JSON.stringify(init.body ?? {}) : undefined,
      cache: "no-store",
    });

    const parsed = await readJson(response);
    if (!response.ok || !isRecord(parsed) || parsed.ok !== true) {
      return {
        ok: false,
        error: readString(parsed, "error") ?? "request_failed",
        message:
          readString(parsed, "message") ??
          "Cloud save is not available right now.",
        status: response.status,
      };
    }

    const data = { ...parsed };
    delete data.ok;
    return { ok: true, data: data as T, status: response.status };
  } catch {
    return {
      ok: false,
      error: "network_error",
      message: "Cloud save is not available right now.",
      status: 0,
    };
  }
}

function headerRecord(headers?: HeadersInit): Record<string, string> {
  if (!headers) return {};
  if (headers instanceof Headers) return Object.fromEntries(headers.entries());
  if (Array.isArray(headers)) return Object.fromEntries(headers);
  return { ...headers };
}

async function readJson(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text.trim()) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readString(
  value: unknown,
  key: string,
): string | null {
  if (!isRecord(value)) return null;
  const item = value[key];
  return typeof item === "string" && item.trim() !== "" ? item : null;
}
