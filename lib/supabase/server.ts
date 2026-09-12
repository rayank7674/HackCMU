import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";
import {
  getSupabasePublicEnv,
  getSupabaseServiceRoleKey,
} from "./env";

export type ServerSupabaseClient = SupabaseClient<Database>;

export type CreateServerSupabaseOptions = {
  /**
   * Use SUPABASE_SERVICE_ROLE_KEY when set. Intended for API routes that
   * have already verified an Auth0 identity. Never send this client to the browser.
   */
  privileged?: boolean;
  /** Auth0 ID token for RLS (`auth.jwt()->>'sub'`). Ignored when privileged. */
  accessToken?: string | null;
};

/**
 * Server Supabase client. Returns null when public env is missing.
 * Prefers the service role only when `privileged: true` and the key is set.
 */
export function createServerSupabaseClient(
  options: CreateServerSupabaseOptions = {},
): ServerSupabaseClient | null {
  const env = getSupabasePublicEnv();
  if (!env) return null;

  const serviceRole =
    options.privileged === true ? getSupabaseServiceRoleKey() : null;
  const key = serviceRole ?? env.anonKey;

  if (options.accessToken && !serviceRole) {
    return createClient<Database>(env.url, key, {
      accessToken: async () => options.accessToken ?? null,
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    });
  }

  return createClient<Database>(env.url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}
