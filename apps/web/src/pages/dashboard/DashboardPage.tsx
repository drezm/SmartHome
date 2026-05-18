import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Bell, CloudSun, Droplets, MapPin, Plus, ShieldCheck, Thermometer, Wifi, Wind, type LucideIcon } from "lucide-react";
import { lazy, Suspense, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CreateScenarioModal } from "@/features/scenarios/CreateScenarioModal";
import { QuickActions } from "@/features/quick-actions/QuickActions";
import { NewsBanner } from "@/features/news/NewsBanner";
import { api } from "@/shared/api/http";
import { liveQueryOptions } from "@/shared/api/liveQuery";
import { queryKeys } from "@/shared/api/queryKeys";
import { buildCustomDateRange } from "@/shared/lib/dateRange";
import { Badge } from "@/shared/ui/Badge";
import { Button } from "@/shared/ui/Button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/Card";
import { Input } from "@/shared/ui/Input";
import type { DateRangeInput } from "@/shared/api/types";
import { StatCard } from "@/widgets/dashboard/StatCard";

const ClimateChart = lazy(() => import("./DashboardCharts").then((module) => ({ default: module.ClimateChart })));
const ActivityChart = lazy(() => import("./DashboardCharts").then((module) => ({ default: module.ActivityChart })));

export function DashboardPage() {
  const [scenarioOpen, setScenarioOpen] = useState(false);
  const [climateRange, setClimateRange] = useState<DateRangeInput>({ preset: "24h" });
  const [customClimateDates, setCustomClimateDates] = useState({ from: "", to: "" });
  const navigate = useNavigate();
  const dashboard = useQuery({ queryKey: queryKeys.dashboard, queryFn: api.dashboard, ...liveQueryOptions });
  const climate = useQuery({ queryKey: queryKeys.climate(climateRange), queryFn: () => api.climate(climateRange), ...liveQueryOptions });
  const news = useQuery({ queryKey: queryKeys.news, queryFn: api.news, enabled: Boolean(dashboard.data) });
  const data = dashboard.data;
  const currentTemperature = data?.stats.temperature;
  const scenarioStatus = getScenarioStatusView(data?.scenarioEvaluation?.status);

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard title="Температура" value={currentTemperature === null || currentTemperature === undefined ? "—" : `${currentTemperature}°C`} subtitle={data?.weather ? "по домашней локации" : "сохраните локацию"} icon={Thermometer} />
        <StatCard title="Устройства на связи" value={`${data?.stats.onlineDevices ?? 0}/${data?.stats.totalDevices ?? 0}`} subtitle="актуально сейчас" icon={Wifi} />
        <StatCard title="Активные сценарии" value={`${data?.stats.activeScenarios ?? 0}`} subtitle="автоматизации включены" icon={ShieldCheck} />
        <StatCard title="События сегодня" value={`${data?.stats.eventsToday ?? 0}`} subtitle="уведомления и события" icon={Bell} />
      </section>

      <QuickActions scenarios={data?.favoriteManualScenarios ?? []} />

      <NewsBanner items={news.data?.news ?? []} />

      <section className="grid items-start gap-6 xl:grid-cols-[1.5fr,1fr]">
        <Card className="rounded-3xl">
          <CardHeader>
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <CardTitle>Климат дома</CardTitle>
                <CardDescription>Температура и влажность за выбранный период</CardDescription>
              </div>
              <ClimateRangeControls
                value={climateRange}
                customDates={customClimateDates}
                onPresetChange={(preset) => setClimateRange({ preset })}
                onCustomDatesChange={(next) => {
                  setCustomClimateDates(next);
                  if (next.from && next.to) {
                    setClimateRange(buildCustomDateRange("24h", next.from, next.to));
                  }
                }}
              />
            </div>
          </CardHeader>
          <CardContent className="h-[320px]">
            <ChartSuspense>
              <ClimateChart range={climate.data?.range ?? null} temperature={climate.data?.temperatureSeries ?? []} humidity={climate.data?.humiditySeries ?? []} />
            </ChartSuspense>
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
            {data?.scenarioEvaluation ? (
              <div className="space-y-3 rounded-2xl border border-white/10 bg-black/20 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm text-zinc-400">Проверка условия</p>
                  <Badge className={scenarioStatus.className}>{scenarioStatus.label}</Badge>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <ScenarioFact
                    label="Текущее значение"
                    value={
                      data.scenarioEvaluation.scenario.automationSource === "schedule"
                        ? data.scenarioEvaluation.scenario.condition
                        : data.scenarioEvaluation.actualValue === null
                          ? "—"
                          : `${data.scenarioEvaluation.actualValue}${data.scenarioEvaluation.unit ?? ""}`
                    }
                  />
                  <ScenarioFact label="Источник" value={data.scenarioEvaluation.scenario.automationSource === "schedule" ? "Время" : data.scenarioEvaluation.scenario.sourceDeviceName ?? "Не выбран"} />
                  <ScenarioFact label="Устройство" value={data.scenarioEvaluation.targetDeviceName} />
                  <ScenarioFact label="Состояние" value={data.scenarioEvaluation.targetEnabled === null ? "—" : data.scenarioEvaluation.targetEnabled ? "Включено" : "Выключено"} />
                  <ScenarioFact label="Последняя проверка" value={formatDateTime(data.scenarioEvaluation.scenario.lastEvaluation.evaluatedAt)} />
                </div>
                {data.scenarioEvaluation.scenario.lastEvaluation.reason ? (
                  <p className="rounded-2xl border border-white/10 bg-white/[0.03] p-3 text-sm text-zinc-300">{data.scenarioEvaluation.scenario.lastEvaluation.reason}</p>
                ) : null}
              </div>
            ) : null}
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
            <ChartSuspense>
              <ActivityChart data={data?.activitySeries ?? []} />
            </ChartSuspense>
          </CardContent>
        </Card>
        <Card className="rounded-3xl">
          <CardHeader>
            <div className="mb-2 w-fit rounded-2xl bg-sky-500/15 p-3">
              <CloudSun className="h-5 w-5 text-sky-200" />
            </div>
            <CardTitle>Погода по локации</CardTitle>
            <CardDescription>{data?.weather?.locationLabel ?? "Домашняя локация не задана"}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {data?.weather ? (
              <>
                <div className="rounded-2xl border border-sky-400/20 bg-sky-500/10 p-5">
                  <p className="text-sm text-sky-200">Снаружи</p>
                  <p className="mt-2 text-4xl font-semibold text-white">{data.weather.temperature}°C</p>
                  <p className="mt-1 text-sm text-zinc-400">Ощущается как {data.weather.apparentTemperature}°C</p>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <WeatherMetric icon={Droplets} label="Влажность" value={`${data.weather.humidity}%`} />
                  <WeatherMetric icon={Wind} label="Ветер" value={`${data.weather.windSpeed} км/ч`} />
                  <WeatherMetric icon={CloudSun} label="Осадки" value={`${data.weather.precipitation} мм`} />
                  <WeatherMetric icon={MapPin} label="Обновлено" value={formatTime(data.weather.updatedAt)} />
                </div>
              </>
            ) : (
              <div className="space-y-4 rounded-2xl border border-white/10 bg-black/20 p-5">
                <p className="text-sm text-zinc-400">Температура появится после сохранения домашней локации.</p>
                <Button type="button" variant="soft" onClick={() => navigate("/settings")}>
                  <MapPin className="h-4 w-4" /> Открыть настройки
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </section>

      <CreateScenarioModal open={scenarioOpen} onClose={() => setScenarioOpen(false)} />
    </motion.div>
  );
}

function ClimateRangeControls({
  value,
  customDates,
  onPresetChange,
  onCustomDatesChange
}: {
  value: DateRangeInput;
  customDates: { from: string; to: string };
  onPresetChange: (preset: "24h" | "7d" | "30d") => void;
  onCustomDatesChange: (value: { from: string; to: string }) => void;
}) {
  const usingCustomDates = Boolean(value.from && value.to);
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {([
          ["24h", "24 часа"],
          ["7d", "7 дней"],
          ["30d", "30 дней"]
        ] as const).map(([preset, label]) => (
          <Button key={preset} variant={!usingCustomDates && value.preset === preset ? "primary" : "soft"} onClick={() => onPresetChange(preset)}>
            {label}
          </Button>
        ))}
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        <Input type="date" value={customDates.from} onChange={(event) => onCustomDatesChange({ ...customDates, from: event.target.value })} aria-label="Дата начала графика" />
        <Input type="date" value={customDates.to} onChange={(event) => onCustomDatesChange({ ...customDates, to: event.target.value })} aria-label="Дата окончания графика" />
      </div>
    </div>
  );
}

function ChartSuspense({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<div className="h-full animate-pulse rounded-2xl bg-white/5" />}>
      {children}
    </Suspense>
  );
}

function WeatherMetric({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: string }) {
  return (
    <div className="flex min-h-20 items-center gap-3 rounded-2xl border border-white/10 bg-black/20 p-4">
      <div className="rounded-xl bg-white/5 p-2">
        <Icon className="h-4 w-4 text-sky-200" />
      </div>
      <div className="min-w-0">
        <p className="text-xs text-zinc-500">{label}</p>
        <p className="mt-1 truncate text-sm font-medium text-white">{value}</p>
      </div>
    </div>
  );
}

function ScenarioFact({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-h-16 rounded-2xl border border-white/10 bg-white/[0.03] p-3">
      <p className="text-xs text-zinc-500">{label}</p>
      <p className="mt-1 break-words text-sm font-medium text-white">{value}</p>
    </div>
  );
}

function getScenarioStatusView(status?: "matched" | "not_matched" | "unknown" | "unsupported") {
  if (status === "matched") {
    return { label: "Условие выполнено", className: "border-emerald-400/20 bg-emerald-500/15 text-emerald-300" };
  }

  if (status === "not_matched") {
    return { label: "Условие не выполнено", className: "border-zinc-400/20 bg-zinc-500/15 text-zinc-300" };
  }

  if (status === "unsupported") {
    return { label: "Только просмотр", className: "border-amber-400/20 bg-amber-500/15 text-amber-200" };
  }

  return { label: "Нет данных", className: "border-sky-400/20 bg-sky-500/15 text-sky-200" };
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat("ru-RU", { hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

function formatDateTime(value: string | null) {
  if (!value) {
    return "Еще не проверялся";
  }

  return new Intl.DateTimeFormat("ru-RU", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}
