import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";
import { getSupabasePublicEnv } from "./env";

export type BrowserSupabaseClient = SupabaseClient<Database>;

let browserClient: BrowserSupabaseClient | null = null;

/**
 * Browser Supabase client (anon key). Returns null when env is missing
 * so the app can build and run without Supabase.
 *
 * Later (Auth0): pass the Auth0 ID token via `accessToken` so RLS sees `sub`.
 */
export function createBrowserSupabaseClient(options?: {
  accessToken?: string | null;
}): BrowserSupabaseClient | null {
  const env = getSupabasePublicEnv();
  if (!env) return null;

  if (options?.accessToken) {
    return createClient<Database>(env.url, env.anonKey, {
      accessToken: async () => options.accessToken ?? null,
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    });
  }

  if (!browserClient) {
    browserClient = createClient<Database>(env.url, env.anonKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    });
  }

  return browserClient;
}

/** @deprecated Use createBrowserSupabaseClient - kept for the unused Phase 1 stub name. */
export function createSupabaseClient(): BrowserSupabaseClient | null {
  return createBrowserSupabaseClient();
}
