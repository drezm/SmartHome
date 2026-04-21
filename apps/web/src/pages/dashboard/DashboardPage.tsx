import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Bell, Plus, ShieldCheck, Thermometer, Wifi } from "lucide-react";
import { Area, AreaChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useState } from "react";
import { CreateScenarioModal } from "@/features/scenarios/CreateScenarioModal";
import { QuickActions } from "@/features/quick-actions/QuickActions";
import { api } from "@/shared/api/http";
import { queryKeys } from "@/shared/api/queryKeys";
import { Button } from "@/shared/ui/Button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/Card";
import { getBackendStatusView } from "@/shared/lib/backendStatus";
import { StatCard } from "@/widgets/dashboard/StatCard";

export function DashboardPage() {
  const [scenarioOpen, setScenarioOpen] = useState(false);
  const dashboard = useQuery({ queryKey: queryKeys.dashboard, queryFn: api.dashboard });
  const data = dashboard.data;
  const backendStatus = getBackendStatusView(data?.backendStatus);

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard title="Температура" value={data?.stats.temperature === null || data?.stats.temperature === undefined ? "—" : `${data.stats.temperature}°C`} subtitle="последнее значение" icon={Thermometer} />
        <StatCard title="Устройства на связи" value={`${data?.stats.onlineDevices ?? 0}/${data?.stats.totalDevices ?? 0}`} subtitle="актуально сейчас" icon={Wifi} />
        <StatCard title="Активные сценарии" value={`${data?.stats.activeScenarios ?? 0}`} subtitle="автоматизации включены" icon={ShieldCheck} />
        <StatCard title="События сегодня" value={`${data?.stats.eventsToday ?? 0}`} subtitle="уведомления и события" icon={Bell} />
      </section>

      <QuickActions />

      <section className="grid gap-6 xl:grid-cols-[1.5fr,1fr]">
        <Card className="rounded-3xl">
          <CardHeader>
            <CardTitle>Температура по времени</CardTitle>
            <CardDescription>Телеметрия за последние измерения</CardDescription>
          </CardHeader>
          <CardContent className="h-[320px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data?.temperatureSeries ?? []}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                <XAxis dataKey="time" stroke="#a1a1aa" />
                <YAxis stroke="#a1a1aa" />
                <Tooltip contentStyle={{ background: "#111216", border: "1px solid rgba(255,255,255,0.08)", color: "#fff" }} />
                <Line type="monotone" dataKey="value" stroke="#8b5cf6" strokeWidth={3} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="rounded-3xl">
          <CardHeader>
            <CardTitle>Текущий сценарий</CardTitle>
            <CardDescription>Самый приоритетный активный сценарий</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
              <p className="text-sm text-zinc-400">Сейчас активно</p>
              <p className="mt-2 break-words text-base font-medium text-white">{data?.currentScenario ? `${data.currentScenario.condition} → ${data.currentScenario.action}` : "Активных сценариев нет"}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
              <p className="text-sm text-zinc-400">Collector</p>
              <p className={`mt-2 text-sm ${backendStatus.textClassName}`}>{backendStatus.detail}</p>
            </div>
            <Button onClick={() => setScenarioOpen(true)} className="h-12 w-full">
              <Plus className="h-4 w-4" /> Добавить сценарий
            </Button>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <Card className="rounded-3xl">
          <CardHeader>
            <CardTitle>Активность за неделю</CardTitle>
            <CardDescription>Количество событий по дням</CardDescription>
          </CardHeader>
          <CardContent className="h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data?.activitySeries ?? []}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                <XAxis dataKey="day" stroke="#a1a1aa" />
                <YAxis stroke="#a1a1aa" />
                <Tooltip contentStyle={{ background: "#111216", border: "1px solid rgba(255,255,255,0.08)", color: "#fff" }} />
                <Area type="monotone" dataKey="events" stroke="#8b5cf6" fill="#8b5cf6" fillOpacity={0.18} />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card className="rounded-3xl">
          <CardContent>
            <div className="grid gap-4">
              <div className="flex flex-col gap-2 rounded-2xl border border-white/10 bg-black/20 p-4 sm:flex-row sm:items-center sm:justify-between">
                <span className="text-sm text-zinc-400">Collector URL</span>
                <span className="break-all font-mono text-sm text-white">{data?.backendStatus.collectorUrl ?? "—"}</span>
              </div>
              <div className="flex flex-col gap-2 rounded-2xl border border-white/10 bg-black/20 p-4 sm:flex-row sm:items-center sm:justify-between">
                <span className="text-sm text-zinc-400">Состояние</span>
                <span className={`text-sm ${backendStatus.textClassName}`}>{backendStatus.label}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </section>

      <CreateScenarioModal open={scenarioOpen} onClose={() => setScenarioOpen(false)} />
    </motion.div>
  );
}
