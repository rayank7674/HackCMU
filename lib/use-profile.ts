"use client";

import { useCallback, useSyncExternalStore } from "react";
import {
  PROFILE_STORAGE_KEY,
  canUseProfileStorage,
  clearProfile,
  emptyPersistedProfile,
  loadProfile,
  saveHomeProfile,
  saveHouseholdProfile,
  type HomeProfile,
  type HouseholdProfile,
  type PersistedProfile,
} from "@/lib/stormready";

const PROFILE_EVENT = "stormready:profile-changed";
const EMPTY_PROFILE = emptyPersistedProfile();

let snapshotRaw: string | null = null;
let snapshot: PersistedProfile = EMPTY_PROFILE;
let snapshotReady = false;

function readSnapshot(): PersistedProfile {
  const raw = canUseProfileStorage()
    ? window.localStorage.getItem(PROFILE_STORAGE_KEY)
    : null;
  if (snapshotReady && raw === snapshotRaw) {
    return snapshot;
  }
  snapshotReady = true;
  snapshotRaw = raw;
  snapshot = loadProfile();
  return snapshot;
}

function subscribe(onChange: () => void) {
  window.addEventListener(PROFILE_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(PROFILE_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

function notifyProfileChanged() {
  snapshotReady = false;
  window.dispatchEvent(new Event(PROFILE_EVENT));
}

function useIsClient() {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
}

export function useProfile() {
  const profile = useSyncExternalStore(subscribe, readSnapshot, () => EMPTY_PROFILE);
  const hydrated = useIsClient();

  const updateHome = useCallback((home: HomeProfile) => {
    const next = saveHomeProfile(home);
    notifyProfileChanged();
    return next;
  }, []);

  const updateHousehold = useCallback((household: HouseholdProfile) => {
    const next = saveHouseholdProfile(household);
    notifyProfileChanged();
    return next;
  }, []);

  const reset = useCallback(() => {
    const next = clearProfile();
    notifyProfileChanged();
    return next;
  }, []);

  return { profile, hydrated, updateHome, updateHousehold, reset };
}
