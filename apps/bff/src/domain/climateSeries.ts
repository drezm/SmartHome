import type { DateRange, TelemetryPoint, TelemetrySeriesPoint } from "./types.js";

type ClimateSeriesOptions = {
  bucketMs?: number;
  temperatureDeviceIds?: string[];
  humidityDeviceIds?: string[];
};

export function normalizeClimateSeries(points: TelemetryPoint[], options: ClimateSeriesOptions = {}) {
  const bucketMs = options.bucketMs ?? 60_000;
  const temperatureSeries = normalizeKind(points, "temperature", bucketMs, options.temperatureDeviceIds);
  const humidity = normalizeKind(points, "humidity", bucketMs, options.humidityDeviceIds);

  return {
    temperatureSeries,
    humiditySeries: interpolateSeries(humidity, collectBuckets(temperatureSeries, humidity))
  };
}

export function getClimateBucketMs(range: Pick<DateRange, "preset" | "from" | "to">) {
  if (range.preset === "24h") {
    return 5 * 60_000;
  }
  if (range.preset === "7d") {
    return 30 * 60_000;
  }
  if (range.preset === "30d") {
    return 2 * 60 * 60_000;
  }

  const durationMs = new Date(range.to).getTime() - new Date(range.from).getTime();
  if (durationMs <= 2 * 24 * 60 * 60_000) {
    return 5 * 60_000;
  }
  if (durationMs <= 14 * 24 * 60 * 60_000) {
    return 30 * 60_000;
  }
  return 2 * 60 * 60_000;
}

function normalizeKind(points: TelemetryPoint[], kind: string, bucketMs: number, deviceIds?: string[]): TelemetrySeriesPoint[] {
  const allowedDeviceIds = deviceIds ? new Set(deviceIds) : null;
  const buckets = new Map<number, number[]>();

  points
    .filter((point) => point.kind === kind && (!allowedDeviceIds || allowedDeviceIds.has(point.deviceId)))
    .forEach((point) => {
      const timestamp = toTimeBucket(point.createdAt, bucketMs);
      buckets.set(timestamp, [...(buckets.get(timestamp) ?? []), point.value]);
    });

  return Array.from(buckets.entries())
    .sort(([left], [right]) => left - right)
    .map(([timestamp, values]) => ({ at: new Date(timestamp).toISOString(), value: round(average(values)) }));
}

function collectBuckets(...series: TelemetrySeriesPoint[][]) {
  return Array.from(new Set(series.flatMap((items) => items.map((point) => new Date(point.at).getTime())))).sort((left, right) => left - right);
}

function interpolateSeries(points: TelemetrySeriesPoint[], buckets: number[]) {
  if (points.length < 2 || buckets.length === 0) {
    return points;
  }

  const actual = new Map(points.map((point) => [new Date(point.at).getTime(), point.value]));
  return buckets.flatMap((timestamp) => {
    const exact = actual.get(timestamp);
    if (exact !== undefined) {
      return [{ at: new Date(timestamp).toISOString(), value: exact }];
    }

    const previous = findPrevious(points, timestamp);
    const next = findNext(points, timestamp);
    if (!previous || !next) {
      return [];
    }

    const previousTime = new Date(previous.at).getTime();
    const nextTime = new Date(next.at).getTime();
    const ratio = (timestamp - previousTime) / (nextTime - previousTime);
    return [{ at: new Date(timestamp).toISOString(), value: round(previous.value + (next.value - previous.value) * ratio) }];
  });
}

function findPrevious(points: TelemetrySeriesPoint[], timestamp: number) {
  for (let index = points.length - 1; index >= 0; index -= 1) {
    if (new Date(points[index].at).getTime() < timestamp) {
      return points[index];
    }
  }
  return null;
}

function findNext(points: TelemetrySeriesPoint[], timestamp: number) {
  return points.find((point) => new Date(point.at).getTime() > timestamp) ?? null;
}

function toTimeBucket(value: string, bucketMs: number) {
  return Math.floor(new Date(value).getTime() / bucketMs) * bucketMs;
}

function average(values: number[]) {
  return values.reduce((total, value) => total + value, 0) / values.length;
}

function round(value: number) {
  return Math.round(value * 10) / 10;
}
