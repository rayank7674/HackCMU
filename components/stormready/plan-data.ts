"use client";

import { useEffect, useState } from "react";
import {
  fetchAlerts,
  fetchRecommendations,
  statusFromResult,
  type OptimizationView,
  type RecommendationView,
  type ResourceStatus,
} from "@/lib/stormready-api";
import { cachePlanExtras } from "@/lib/plan-cache";
import { isKnown, type HazardState, type PersistedProfile } from "@/lib/stormready";

export type PlanQuery = {
  alerts: HazardState | null;
  alertsStatus: ResourceStatus;
  recommendations: RecommendationView[];
  recommendationsStatus: ResourceStatus;
  optimization: OptimizationView | null;
  /** True while either live request is still in flight. */
  loading: boolean;
  alertsUnavailable: boolean;
  recommendationsUnavailable: boolean;
};

const idle: PlanQuery = {
  alerts: null,
  alertsStatus: "idle",
  recommendations: [],
  recommendationsStatus: "idle",
  optimization: null,
  loading: false,
  alertsUnavailable: false,
  recommendationsUnavailable: false,
};

type FetchedPlan = {
  key: string;
  alerts: HazardState | null;
  alertsStatus: ResourceStatus;
  recommendations: RecommendationView[];
  recommendationsStatus: ResourceStatus;
  optimization: OptimizationView | null;
};

function toQuery(data: Omit<FetchedPlan, "key">): PlanQuery {
  const alertsBlocked =
    data.alertsStatus === "error" || data.alertsStatus === "unavailable";
  const recsBlocked =
    data.recommendationsStatus === "error" ||
    data.recommendationsStatus === "unavailable";
  return {
    ...data,
    loading:
      data.alertsStatus === "loading" ||
      data.recommendationsStatus === "loading",
    alertsUnavailable: alertsBlocked,
    recommendationsUnavailable: recsBlocked,
  };
}

export function usePlanData(
  profile: PersistedProfile,
  hydrated: boolean,
): PlanQuery {
  const postalCode =
    profile.home && isKnown(profile.home.postalCode) ? profile.home.postalCode : "";
  const city = profile.home && isKnown(profile.home.city) ? profile.home.city : "";
  const addressLine =
    profile.home && isKnown(profile.home.addressLine)
      ? profile.home.addressLine
      : "";
  const homeId = profile.home?.id ?? "";
  const householdId = profile.household?.id ?? "";
  const updatedAt = profile.updatedAt ?? "";
  const cacheKey = `${homeId}|${householdId}|${postalCode}|${city}|${addressLine}|${updatedAt}`;
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
        addressLine: isKnown(home.addressLine) ? home.addressLine : undefined,
        postalCode: isKnown(home.postalCode) ? home.postalCode : undefined,
        city: isKnown(home.city) ? home.city : undefined,
        state: isKnown(home.state) ? home.state : undefined,
        location: home.location,
      });

      const hazards = alertsResult.ok ? alertsResult.data : null;
      if (cancelled) return;

      setData({
        key,
        alerts: hazards,
        alertsStatus: statusFromResult(alertsResult),
        recommendations: [],
        recommendationsStatus: "loading",
        optimization: null,
      });

      const recsResult = await fetchRecommendations({
        home,
        household,
        hazards,
        hazardSource: alertsResult.ok ? "live" : "unavailable",
      });

      if (cancelled) return;

      const recommendations = recsResult.ok
        ? recsResult.data.recommendations.slice(0, 5)
        : [];
      const optimization = recsResult.ok ? recsResult.data.optimization : null;
      cachePlanExtras({
        hazards,
        recommendations,
      });

      setData({
        key,
        alerts: hazards,
        alertsStatus: statusFromResult(alertsResult),
        recommendations,
        recommendationsStatus: statusFromResult(recsResult),
        optimization,
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
    return toQuery({
      alerts: null,
      alertsStatus: "loading",
      recommendations: [],
      recommendationsStatus: "loading",
      optimization: null,
    });
  }

  return toQuery(data);
}
