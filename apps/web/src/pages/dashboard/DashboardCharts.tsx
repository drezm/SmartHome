import { Area, AreaChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { DateRange, TelemetrySeriesPoint } from "@/shared/api/types";

export function ClimateChart({
  range,
  temperature,
  humidity
}: {
  range: DateRange | null;
  temperature: TelemetrySeriesPoint[];
  humidity: TelemetrySeriesPoint[];
}) {
  const data = mergeClimateSeries(temperature, humidity);
  const formatter = buildTickFormatter(range);

  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
        <XAxis dataKey="timestamp" stroke="#a1a1aa" tickFormatter={formatter} minTickGap={28} />
        <YAxis yAxisId="temperature" stroke="#8b5cf6" tickFormatter={(value) => `${value}°`} width={42} />
        <YAxis yAxisId="humidity" orientation="right" stroke="#38bdf8" tickFormatter={(value) => `${value}%`} width={42} />
        <Tooltip
          labelFormatter={(value) => formatTooltipTime(String(value))}
          formatter={(value, name) => [`${value}${name === "Температура" ? "°C" : "%"}`, name]}
          contentStyle={{ background: "#111216", border: "1px solid rgba(255,255,255,0.08)", color: "#fff" }}
        />
        <Legend />
        <Line yAxisId="temperature" connectNulls type="monotone" dataKey="temperature" name="Температура" stroke="#8b5cf6" strokeWidth={3} dot={false} />
        <Line yAxisId="humidity" connectNulls type="monotone" dataKey="humidity" name="Влажность" stroke="#38bdf8" strokeWidth={3} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}

export function ActivityChart({ data }: { data: Array<{ day: string; events: number }> }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
        <XAxis dataKey="day" stroke="#a1a1aa" />
        <YAxis stroke="#a1a1aa" />
        <Tooltip contentStyle={{ background: "#111216", border: "1px solid rgba(255,255,255,0.08)", color: "#fff" }} />
        <Area type="monotone" dataKey="events" stroke="#8b5cf6" fill="#8b5cf6" fillOpacity={0.18} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

function mergeClimateSeries(temperature: TelemetrySeriesPoint[], humidity: TelemetrySeriesPoint[]) {
  const rows = new Map<number, { timestamp: string; temperature?: number; humidity?: number }>();
  temperature.forEach((point) => {
    const timestamp = toMinuteBucket(point.at);
    rows.set(timestamp, { ...(rows.get(timestamp) ?? { timestamp: new Date(timestamp).toISOString() }), temperature: point.value });
  });
  humidity.forEach((point) => {
    const timestamp = toMinuteBucket(point.at);
    rows.set(timestamp, { ...(rows.get(timestamp) ?? { timestamp: new Date(timestamp).toISOString() }), humidity: point.value });
  });
  return Array.from(rows.entries())
    .sort(([left], [right]) => left - right)
    .map(([, value]) => value);
}

function toMinuteBucket(value: string) {
  const date = new Date(value);
  date.setSeconds(0, 0);
  return date.getTime();
}

function buildTickFormatter(range: DateRange | null) {
  if (range?.preset === "24h") {
    return (value: string) => new Intl.DateTimeFormat("ru-RU", { hour: "2-digit", minute: "2-digit" }).format(new Date(value));
  }
  return (value: string) => new Intl.DateTimeFormat("ru-RU", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

function formatTooltipTime(value: string) {
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "long",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}
