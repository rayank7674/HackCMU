/** Browser geolocation is opt-in. Never call navigator.geolocation without a click. */

export type DeviceCoordinates = {
  latitude: number;
  longitude: number;
};

export function parseDeviceCoordinates(input: {
  latitude: unknown;
  longitude: unknown;
}): DeviceCoordinates | null {
  const latitude =
    typeof input.latitude === "number" ? input.latitude : Number(input.latitude);
  const longitude =
    typeof input.longitude === "number" ? input.longitude : Number(input.longitude);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  if (Math.abs(latitude) > 90 || Math.abs(longitude) > 180) return null;
  return { latitude, longitude };
}

export function shouldRequestGeolocation(trigger: "idle" | "user_click"): boolean {
  return trigger === "user_click";
}
