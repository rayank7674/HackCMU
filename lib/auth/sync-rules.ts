import type { PersistedProfile } from "@/lib/profile-store";

/**
 * Restore cloud → local when local is empty or older.
 */
export function shouldRestoreCloudProfile(
  local: PersistedProfile,
  cloudUpdatedAt: string | null | undefined,
): boolean {
  const localEmpty = local.home === null && local.household === null;
  if (localEmpty) return true;
  if (!cloudUpdatedAt) return false;
  if (!local.updatedAt) return true;
  const cloudMs = Date.parse(cloudUpdatedAt);
  const localMs = Date.parse(local.updatedAt);
  if (!Number.isFinite(cloudMs)) return false;
  if (!Number.isFinite(localMs)) return true;
  return cloudMs > localMs;
}

/**
 * Push local → cloud after Save My Plan login, or when local is newer
 * / cloud has nothing yet.
 */
export function shouldMigrateLocalProfile(
  local: PersistedProfile,
  cloudUpdatedAt: string | null | undefined,
  pendingSave: boolean,
): boolean {
  if (!local.home && !local.household) return false;
  if (pendingSave) return true;
  if (!cloudUpdatedAt) return true;
  if (!local.updatedAt) return true;
  const cloudMs = Date.parse(cloudUpdatedAt);
  const localMs = Date.parse(local.updatedAt);
  if (!Number.isFinite(localMs)) return true;
  if (!Number.isFinite(cloudMs)) return true;
  return localMs >= cloudMs;
}
