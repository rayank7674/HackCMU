"use client";

import { useState, useSyncExternalStore } from "react";
import { ONBOARDING_PROGRESS_KEY } from "@/lib/stormready-format";

const PROGRESS_EVENT = "stormready:onboarding-changed";

type Progress = {
  step: number;
};

let rawCache: string | null = null;
let stepCache = 0;
let ready = false;

function parseStep(raw: string | null): number {
  if (!raw) return 0;
  try {
    const parsed = JSON.parse(raw) as Progress;
    if (typeof parsed.step === "number" && parsed.step >= 0 && parsed.step <= 5) {
      return parsed.step;
    }
  } catch {
    return 0;
  }
  return 0;
}

function readStep(): number {
  const raw =
    typeof window === "undefined"
      ? null
      : window.localStorage.getItem(ONBOARDING_PROGRESS_KEY);
  if (ready && raw === rawCache) return stepCache;
  ready = true;
  rawCache = raw;
  stepCache = parseStep(raw);
  return stepCache;
}

function subscribe(onChange: () => void) {
  window.addEventListener(PROGRESS_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(PROGRESS_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

export function saveOnboardingStep(step: number) {
  try {
    window.localStorage.setItem(
      ONBOARDING_PROGRESS_KEY,
      JSON.stringify({ step }),
    );
  } catch {
    // Private mode should not block onboarding.
  }
  ready = false;
  window.dispatchEvent(new Event(PROGRESS_EVENT));
}

export function clearOnboardingStep() {
  try {
    window.localStorage.removeItem(ONBOARDING_PROGRESS_KEY);
  } catch {
    // Ignore.
  }
  ready = false;
  window.dispatchEvent(new Event(PROGRESS_EVENT));
}

export function useOnboardingStep() {
  const stored = useSyncExternalStore(subscribe, readStep, () => 0);
  const [override, setOverride] = useState<number | null>(null);
  const step = override ?? stored;

  const goTo = (nextStep: number) => {
    const clamped = Math.min(Math.max(nextStep, 0), 5);
    setOverride(clamped);
    saveOnboardingStep(clamped);
  };

  return { step, goTo, clear: clearOnboardingStep };
}
