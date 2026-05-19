import { Area, AreaChart, Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { ReportSeries } from "@/shared/api/types";

const colors = ["#10b981", "#8b5cf6", "#38bdf8", "#f59e0b"];

export function DeviceActivityChart({ data }: { data: Array<{ day: string; events: number }> }) {
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

export function ReportLineChart({ series }: { series: ReportSeries[] }) {
  const data = mergeSeries(series);

  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
        <XAxis dataKey="label" stroke="#a1a1aa" />
        <YAxis stroke="#a1a1aa" />
        <Tooltip contentStyle={{ background: "#111216", border: "1px solid rgba(255,255,255,0.08)", color: "#fff" }} />
        {series.length > 1 ? <Legend /> : null}
        {series.map((item, index) => (
          <Line key={item.label} connectNulls type="monotone" dataKey={item.label} stroke={colors[index % colors.length]} strokeWidth={3} dot={false} />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}

export function ReportBarChart({ data }: { data: Array<{ label: string; value: number }> }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
        <XAxis dataKey="label" stroke="#a1a1aa" />
        <YAxis stroke="#a1a1aa" />
        <Tooltip contentStyle={{ background: "#111216", border: "1px solid rgba(255,255,255,0.08)", color: "#fff" }} />
        <Bar dataKey="value" fill="#8b5cf6" radius={[6, 6, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

function mergeSeries(series: ReportSeries[]) {
  const rows = new Map<string, Record<string, string | number>>();
  series.forEach((item) => {
    item.points.forEach((point) => {
      const row = rows.get(point.at) ?? { at: point.at, label: point.label };
      row[item.label] = point.value;
      rows.set(point.at, row);
    });
  });
  return Array.from(rows.values()).sort((left, right) => String(left.at).localeCompare(String(right.at)));
}
