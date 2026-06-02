import { describe, expect, it } from "vitest";
import { getClimateBucketMs, normalizeClimateSeries } from "../domain/climateSeries.js";
import type { Device, TelemetryPoint } from "../domain/types.js";
import { buildHomeSensorReading } from "../services/homeSensorService.js";

describe("normalizeClimateSeries", () => {
  it("interpolates humidity on existing climate buckets without mutating source points", () => {
    const points = [
      telemetry("temperature", 20, "2026-05-18T08:00:00.000Z"),
      telemetry("temperature", 21, "2026-05-18T08:01:00.000Z"),
      telemetry("temperature", 22, "2026-05-18T08:02:00.000Z"),
      telemetry("humidity", 40, "2026-05-18T08:00:00.000Z"),
      telemetry("humidity", 50, "2026-05-18T08:02:00.000Z")
    ];

    const result = normalizeClimateSeries(points);

    expect(result.humiditySeries).toEqual([
      { at: "2026-05-18T08:00:00.000Z", value: 40 },
      { at: "2026-05-18T08:01:00.000Z", value: 45 },
      { at: "2026-05-18T08:02:00.000Z", value: 50 }
    ]);
    expect(points).toHaveLength(5);
  });

  it("averages buckets and keeps selected sensors separate", () => {
    const points = [
      telemetry("temperature", 20, "2026-05-18T08:01:00.000Z", "kitchen"),
      telemetry("temperature", 22, "2026-05-18T08:04:00.000Z", "kitchen"),
      telemetry("temperature", 30, "2026-05-18T08:03:00.000Z", "street"),
      telemetry("humidity", 45, "2026-05-18T08:02:00.000Z", "bedroom")
    ];

    const result = normalizeClimateSeries(points, {
      bucketMs: 5 * 60_000,
      temperatureDeviceIds: ["kitchen"],
      humidityDeviceIds: ["bedroom"]
    });

    expect(result.temperatureSeries).toEqual([{ at: "2026-05-18T08:00:00.000Z", value: 21 }]);
    expect(result.humiditySeries).toEqual([{ at: "2026-05-18T08:00:00.000Z", value: 45 }]);
  });

  it("uses readable chart buckets for presets", () => {
    const range = { from: "2026-05-18T00:00:00.000Z", to: "2026-05-19T00:00:00.000Z" };
    expect(getClimateBucketMs({ ...range, preset: "24h" })).toBe(5 * 60_000);
    expect(getClimateBucketMs({ ...range, preset: "7d" })).toBe(30 * 60_000);
    expect(getClimateBucketMs({ ...range, preset: "30d" })).toBe(2 * 60 * 60_000);
  });

  it("generates smooth home sensor changes from the previous value", () => {
    const sensor = homeSensor("temperature");
    const next = buildHomeSensorReading(sensor, new Date("2026-05-18T08:00:30.000Z"), 22);

    expect(next.value).toBeGreaterThanOrEqual(21.7);
    expect(next.value).toBeLessThanOrEqual(22.3);
  });
});

function telemetry(kind: string, value: number, createdAt: string, deviceId = kind): TelemetryPoint {
  return {
    id: `${kind}-${createdAt}`,
    deviceId,
    kind,
    value,
    unit: kind === "humidity" ? "%" : "°C",
    source: "home_sensor",
    externalObservedAt: createdAt,
    externalEventId: null,
    createdAt
  };
}

function homeSensor(sourceMetric: "temperature" | "humidity" | "co2"): Device {
  return {
    id: `sensor-${sourceMetric}`,
    name: sourceMetric,
    type: "CLIMATE_SENSOR",
    category: "Датчики",
    room: "Кухня",
    online: true,
    enabled: true,
    metric: null,
    sourceKind: "home_sensor",
    sourceMetric,
    isSystem: false,
    lastSeen: "2026-05-18T08:00:00.000Z",
    createdAt: "2026-05-18T08:00:00.000Z"
  };
}
