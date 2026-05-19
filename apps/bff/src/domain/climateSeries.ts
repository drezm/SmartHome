import type { TelemetryPoint, TelemetrySeriesPoint } from "./types.js";

export function normalizeClimateSeries(points: TelemetryPoint[]) {
  const temperatureSeries = normalizeKind(points, "temperature");
  const humidity = normalizeKind(points, "humidity");

  return {
    temperatureSeries,
    humiditySeries: interpolateSeries(humidity, collectBuckets(temperatureSeries, humidity))
  };
}

function normalizeKind(points: TelemetryPoint[], kind: string): TelemetrySeriesPoint[] {
  const buckets = new Map<number, TelemetrySeriesPoint>();

  points
    .filter((point) => point.kind === kind)
    .forEach((point) => {
      const timestamp = toMinuteBucket(point.createdAt);
      buckets.set(timestamp, { at: new Date(timestamp).toISOString(), value: point.value });
    });

  return Array.from(buckets.values()).sort((left, right) => new Date(left.at).getTime() - new Date(right.at).getTime());
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

function toMinuteBucket(value: string) {
  const date = new Date(value);
  date.setSeconds(0, 0);
  return date.getTime();
}

function round(value: number) {
  return Math.round(value * 10) / 10;
}
