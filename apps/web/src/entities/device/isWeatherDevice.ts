import type { Device } from "@/shared/api/types";

export function isWeatherDevice(device: Pick<Device, "id" | "isSystem" | "sourceKind">) {
  return device.isSystem && device.sourceKind === "open_meteo" && !device.id.startsWith("weather-outdoor-");
}

export function isLegacyWeatherDevice(device: Pick<Device, "id">) {
  return device.id.startsWith("weather-outdoor-");
}

export function isHomeSensorDevice(device: Pick<Device, "sourceKind">) {
  return device.sourceKind === "home_sensor";
}

export function isManagedDevice(device: Pick<Device, "sourceKind">) {
  return device.sourceKind === "manual";
}

export function isScenarioSourceDevice(device: Pick<Device, "sourceKind" | "sourceMetric">) {
  return (device.sourceKind === "home_sensor" || device.sourceKind === "open_meteo") && Boolean(device.sourceMetric);
}
