import { describe, expect, it } from "vitest";
import { normalizeClimateSeries } from "../domain/climateSeries.js";
import type { TelemetryPoint } from "../domain/types.js";

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
});

function telemetry(kind: string, value: number, createdAt: string): TelemetryPoint {
  return {
    id: `${kind}-${createdAt}`,
    deviceId: kind,
    kind,
    value,
    unit: kind === "humidity" ? "%" : "°C",
    source: "home_sensor",
    externalObservedAt: createdAt,
    externalEventId: null,
    createdAt
  };
}
