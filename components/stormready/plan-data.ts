"use client";

import { useEffect, useState } from "react";
import {
  fetchAlerts,
  fetchRecommendations,
  type RecommendationView,
} from "@/lib/stormready-api";
import { isKnown, type HazardState, type PersistedProfile } from "@/lib/stormready";

export type PlanQuery = {
  alerts: HazardState | null;
  alertsUnavailable: boolean;
  recommendations: RecommendationView[];
  recommendationsUnavailable: boolean;
  loading: boolean;
};

const idle: PlanQuery = {
  alerts: null,
  alertsUnavailable: false,
  recommendations: [],
  recommendationsUnavailable: false,
  loading: false,
};

type FetchedPlan = Omit<PlanQuery, "loading"> & { key: string };

export function usePlanData(profile: PersistedProfile, hydrated: boolean): PlanQuery {
  const postalCode =
    profile.home && isKnown(profile.home.postalCode) ? profile.home.postalCode : "";
  const city = profile.home && isKnown(profile.home.city) ? profile.home.city : "";
  const homeId = profile.home?.id ?? "";
  const householdId = profile.household?.id ?? "";
  const updatedAt = profile.updatedAt ?? "";
  const cacheKey = `${homeId}|${householdId}|${postalCode}|${city}|${updatedAt}`;
  const [data, setData] = useState<FetchedPlan | null>(null);

  useEffect(() => {
    if (!hydrated || !profile.home) {
      return;
    }

    const key = cacheKey;
    const home = profile.home;
    const household = profile.household;
    let cancelled = false;

    (async () => {
      const alertsResult = await fetchAlerts({
        postalCode: isKnown(home.postalCode) ? home.postalCode : undefined,
        city: isKnown(home.city) ? home.city : undefined,
        state: isKnown(home.state) ? home.state : undefined,
        location: home.location,
      });

      const hazards = alertsResult.ok ? alertsResult.data : null;
      const recsResult = await fetchRecommendations({
        home,
        household,
        hazards,
      });

      if (cancelled) return;

      setData({
        key,
        alerts: hazards,
        alertsUnavailable: !alertsResult.ok,
        recommendations: recsResult.ok ? recsResult.data.slice(0, 5) : [],
        recommendationsUnavailable: !recsResult.ok,
      });
    })();

    return () => {
      cancelled = true;
    };
  }, [hydrated, cacheKey, profile.home, profile.household]);

  if (!hydrated || !profile.home) {
    return idle;
  }

  if (!data || data.key !== cacheKey) {
    return { ...idle, loading: true };
  }

  return { ...data, loading: false };
}
