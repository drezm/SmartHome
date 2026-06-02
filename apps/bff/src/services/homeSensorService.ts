import { env } from "../config/env.js";
import type { Device, DeviceCategory, DeviceType, HomeSensorMetric } from "../domain/types.js";
import type { HomeStore } from "../repositories/contracts.js";

type HomeSensorDefinition = {
  metric: HomeSensorMetric;
  label: string;
  kind: HomeSensorMetric;
  type: DeviceType;
  category: DeviceCategory;
  unit: string | null;
};

export const HOME_SENSOR_DEFINITIONS: HomeSensorDefinition[] = [
  { metric: "temperature", label: "Температура", kind: "temperature", type: "TEMPERATURE_SENSOR", category: "Датчики", unit: "°C" },
  { metric: "humidity", label: "Влажность", kind: "humidity", type: "CLIMATE_SENSOR", category: "Датчики", unit: "%" },
  { metric: "illuminance", label: "Освещенность", kind: "illuminance", type: "LIGHT_SENSOR", category: "Датчики", unit: "лк" },
  { metric: "motion", label: "Движение", kind: "motion", type: "MOTION_SENSOR", category: "Безопасность", unit: null },
  { metric: "co2", label: "CO2", kind: "co2", type: "CLIMATE_SENSOR", category: "Датчики", unit: "ppm" },
  { metric: "switch", label: "Выключатель", kind: "switch", type: "SWITCH_SENSOR", category: "Датчики", unit: null }
];

export class HomeSensorService {
  constructor(private readonly home: HomeStore) {}

  async refreshUserSensors(userId: string, devices?: Device[]) {
    const source = devices ?? (await this.home.listDevices(userId));
    const sensors = source.filter(isHomeSensorDevice);
    const telemetry = await this.home.listLatestTelemetry(userId);
    const now = new Date();

    for (const sensor of sensors) {
      if (!sensor.sourceMetric) {
        continue;
      }

      const latest = telemetry
        .filter((point) => point.deviceId === sensor.id && point.kind === sensor.sourceMetric)
        .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime())[0];

      if (latest && now.getTime() - new Date(latest.createdAt).getTime() < env.AUTOMATION_INTERVAL_MS) {
        continue;
      }

      const reading = buildHomeSensorReading(sensor, now, latest?.value);
      await this.home.createTelemetry(userId, {
        deviceId: sensor.id,
        kind: reading.kind,
        value: reading.value,
        unit: reading.unit,
        source: "home_sensor",
        externalObservedAt: now.toISOString(),
        externalEventId: `home-sensor:${sensor.id}:${Math.floor(now.getTime() / env.AUTOMATION_INTERVAL_MS)}:${reading.kind}`
      });
    }
  }
}

export function isHomeSensorMetric(value: string | null | undefined): value is HomeSensorMetric {
  return HOME_SENSOR_DEFINITIONS.some((definition) => definition.metric === value);
}

export function getHomeSensorDefinition(metric: HomeSensorMetric) {
  const definition = HOME_SENSOR_DEFINITIONS.find((item) => item.metric === metric);
  if (!definition) {
    throw new Error(`Unsupported home sensor metric: ${metric}`);
  }
  return definition;
}

export function isHomeSensorDevice(device: Pick<Device, "sourceKind" | "sourceMetric">) {
  return device.sourceKind === "home_sensor" && isHomeSensorMetric(device.sourceMetric);
}

export function buildHomeSensorReading(sensor: Device, now: Date, previousValue?: number) {
  const definition = getHomeSensorDefinition(sensor.sourceMetric as HomeSensorMetric);
  const phase = hash(sensor.id) % 17;
  const minute = Math.floor(now.getTime() / 60_000);
  const hour = now.getHours() + now.getMinutes() / 60;
  const dayWave = Math.sin(((hour - 8) / 24) * Math.PI * 2);
  const noise = deterministicNoise(`${sensor.id}:${Math.floor(now.getTime() / env.AUTOMATION_INTERVAL_MS)}`);

  if (definition.metric === "temperature") {
    return { kind: definition.kind, value: smoothReading(previousValue, 22 + dayWave * 1.8, noise * 0.12, 18, 27, 0.3), unit: definition.unit };
  }
  if (definition.metric === "humidity") {
    return { kind: definition.kind, value: smoothReading(previousValue, 48 - dayWave * 5, noise * 0.25, 35, 65, 0.6), unit: definition.unit };
  }
  if (definition.metric === "illuminance") {
    const daylight = Math.max(0, Math.sin(((hour - 6) / 12) * Math.PI));
    return { kind: definition.kind, value: Math.round(80 + daylight * 720), unit: definition.unit };
  }
  if (definition.metric === "motion") {
    return { kind: definition.kind, value: (minute + phase) % 5 === 0 ? 1 : 0, unit: definition.unit };
  }
  if (definition.metric === "co2") {
    return { kind: definition.kind, value: Math.round(smoothReading(previousValue, 650 + dayWave * 90, noise * 5, 480, 950, 12)), unit: definition.unit };
  }

  return { kind: definition.kind, value: sensor.enabled ? 1 : 0, unit: definition.unit };
}

function round(value: number) {
  return Math.round(value * 10) / 10;
}

function smoothReading(previousValue: number | undefined, target: number, noise: number, min: number, max: number, maxStep: number) {
  if (previousValue === undefined) {
    return round(clamp(target + noise, min, max));
  }

  const next = previousValue + (target - previousValue) * 0.04 + noise;
  return round(clamp(next, Math.max(min, previousValue - maxStep), Math.min(max, previousValue + maxStep)));
}

function deterministicNoise(value: string) {
  return (hash(value) / 0xffffffff - 0.5) * 2;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function hash(value: string) {
  let result = 0;
  for (const char of value) {
    result = (result * 31 + char.charCodeAt(0)) >>> 0;
  }
  return result;
}
