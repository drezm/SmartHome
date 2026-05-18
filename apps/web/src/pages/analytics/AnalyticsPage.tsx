import { useMutation, useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Download, Lock } from "lucide-react";
import { lazy, Suspense, useEffect, useMemo, useState, type Dispatch, type ReactNode, type SetStateAction } from "react";
import { NotificationRow } from "@/entities/notification/NotificationRow";
import { api } from "@/shared/api/http";
import { liveQueryOptions } from "@/shared/api/liveQuery";
import { queryKeys } from "@/shared/api/queryKeys";
import { buildCustomDateRange, formatDateRangeLabel, isCustomDateRange } from "@/shared/lib/dateRange";
import type { DateRangeInput, Device, ReportBlock, ReportKind, ReportParameterDefinition, ReportParameters } from "@/shared/api/types";
import { Button } from "@/shared/ui/Button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/Card";
import { Input } from "@/shared/ui/Input";
import { LockedPreview } from "@/shared/ui/LockedPreview";
import { Select } from "@/shared/ui/Select";
import { SectionTitle } from "@/widgets/dashboard/SectionTitle";

const DeviceActivityChart = lazy(() => import("./AnalyticsCharts").then((module) => ({ default: module.DeviceActivityChart })));
const ReportLineChart = lazy(() => import("./AnalyticsCharts").then((module) => ({ default: module.ReportLineChart })));
const ReportBarChart = lazy(() => import("./AnalyticsCharts").then((module) => ({ default: module.ReportBarChart })));

export function AnalyticsPage() {
  const [range, setRange] = useState<DateRangeInput>({ preset: "7d" });
  const [customDates, setCustomDates] = useState({ from: "", to: "" });
  const [selectedReport, setSelectedReport] = useState<ReportKind>("home_summary");
  const [parameters, setParameters] = useState<ReportParameters>({});
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const dashboard = useQuery({ queryKey: queryKeys.dashboard, queryFn: api.dashboard, ...liveQueryOptions });
  const notifications = useQuery({ queryKey: queryKeys.notifications, queryFn: api.notifications, ...liveQueryOptions });
  const reports = useQuery({ queryKey: queryKeys.reports, queryFn: api.reports });
  const devices = useQuery({ queryKey: queryKeys.devices, queryFn: api.devices, ...liveQueryOptions });
  const catalog = reports.data?.reports ?? [];
  const allDevices = devices.data?.devices ?? [];
  const selectedCatalogItem = useMemo(() => catalog.find((item) => item.kind === selectedReport), [catalog, selectedReport]);
  const effectiveParameters = useMemo(
    () => pickReportParameters(selectedCatalogItem?.parameters ?? [], withDefaultReportParameters(selectedCatalogItem?.parameters ?? [], parameters, allDevices)),
    [allDevices, parameters, selectedCatalogItem?.parameters]
  );
  const parametersReady = hasRequiredParameters(selectedCatalogItem?.parameters ?? [], effectiveParameters);
  const report = useQuery({
    queryKey: queryKeys.report(selectedReport, range, effectiveParameters),
    queryFn: () => api.report(selectedReport, range, effectiveParameters),
    enabled: Boolean(selectedCatalogItem?.available && parametersReady)
  });
  const download = useMutation({
    mutationFn: () => api.reportPdf(selectedReport, range, effectiveParameters),
    onSuccess: (blob) => {
      setDownloadError(null);
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `smart-home-${selectedReport}-${range.from && range.to ? "custom" : range.preset}.pdf`;
      link.click();
      URL.revokeObjectURL(url);
    },
    onError: (error) => setDownloadError(error instanceof Error ? error.message : "Не удалось скачать PDF")
  });
  const isPremium = dashboard.data?.subscription?.isPremium;

  useEffect(() => {
    if (catalog.length === 0 || selectedCatalogItem?.available) {
      return;
    }
    const firstAvailable = catalog.find((item) => item.available);
    if (firstAvailable) {
      setSelectedReport(firstAvailable.kind);
    }
  }, [catalog, selectedCatalogItem?.available]);

  useEffect(() => {
    setParameters((current) => withDefaultReportParameters(selectedCatalogItem?.parameters ?? [], current, allDevices));
  }, [allDevices, selectedCatalogItem?.parameters]);

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <SectionTitle title="Аналитика" description="Сводка по телеметрии и активности устройств" />
      <div className="grid gap-6 xl:grid-cols-2">
        <Card className="rounded-3xl">
          <CardHeader>
            <CardTitle>Активность устройств</CardTitle>
            <CardDescription>Количество событий по дням</CardDescription>
          </CardHeader>
          <CardContent className="h-[320px]">
            <ChartSuspense>
              <DeviceActivityChart data={dashboard.data?.activitySeries ?? []} />
            </ChartSuspense>
          </CardContent>
        </Card>

        <Card className="rounded-3xl">
          <CardHeader>
            <CardTitle>Последние события</CardTitle>
            <CardDescription>Лента активности дома</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="max-h-[320px] space-y-4 overflow-y-auto pr-2">
              {(notifications.data?.notifications ?? []).slice(0, 8).map((item) => (
                <NotificationRow key={item.id} item={item} />
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="rounded-3xl">
        <CardHeader>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <CardTitle>Библиотека отчетов</CardTitle>
              <CardDescription>5 отчетов доступны всем, еще 5 открываются с Premium.</CardDescription>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button variant={!isCustomDateRange(range) && range.preset === "7d" ? "primary" : "soft"} onClick={() => setRange({ preset: "7d" })}>7 дней</Button>
              <Button variant={!isCustomDateRange(range) && range.preset === "30d" ? "primary" : "soft"} onClick={() => setRange({ preset: "30d" })}>30 дней</Button>
              <Button
                variant="soft"
                onClick={() => download.mutate()}
                disabled={!isPremium || download.isPending || !selectedCatalogItem?.available || !parametersReady}
              >
                <Download className="h-4 w-4" /> Скачать PDF
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-3 md:max-w-md md:grid-cols-2">
            <label className="space-y-2 text-sm text-zinc-400">
              <span>С</span>
              <Input
                type="date"
                value={customDates.from}
                onChange={(event) => updateCustomRange({ ...customDates, from: event.target.value }, setCustomDates, setRange)}
              />
            </label>
            <label className="space-y-2 text-sm text-zinc-400">
              <span>По</span>
              <Input
                type="date"
                value={customDates.to}
                onChange={(event) => updateCustomRange({ ...customDates, to: event.target.value }, setCustomDates, setRange)}
              />
            </label>
          </div>

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
            {catalog.map((item) => (
              <button
                key={item.kind}
                type="button"
                onClick={() => item.available && setSelectedReport(item.kind)}
                className={`rounded-2xl border p-4 text-left transition ${
                  selectedReport === item.kind && item.available
                    ? "border-violet-400/40 bg-violet-500/15"
                    : item.available
                      ? "border-white/10 bg-black/20 hover:border-white/20 hover:bg-white/[0.04]"
                      : "cursor-default border-white/10 bg-black/10 opacity-70"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <p className="font-medium text-white">{item.title}</p>
                  {!item.available ? <Lock className="h-4 w-4 shrink-0 text-zinc-500" /> : null}
                </div>
                <p className="mt-2 text-sm text-zinc-400">{item.description}</p>
              </button>
            ))}
          </div>

          {selectedCatalogItem?.available ? (
            <div className="space-y-5">
              {selectedCatalogItem.parameters.length > 0 ? (
                <ReportParameterControls
                  definitions={selectedCatalogItem.parameters}
                  devices={allDevices}
                  value={effectiveParameters}
                  onChange={setParameters}
                />
              ) : null}
              {downloadError ? <p className="rounded-2xl border border-red-400/20 bg-red-500/10 p-3 text-sm text-red-100">{downloadError}</p> : null}
              <div>
                <p className="text-lg font-medium text-white">{report.data?.report.title ?? selectedCatalogItem.title}</p>
                <p className="mt-1 text-sm text-zinc-400">{report.data?.report.summary ?? (parametersReady ? "Загружаем отчет..." : "Выберите параметры отчета.")}</p>
                {report.data?.report.range ? <p className="mt-1 text-sm text-zinc-500">Период: {formatDateRangeLabel(report.data.report.range)}</p> : null}
              </div>
              <div className="space-y-4">
                {(report.data?.report.blocks ?? []).map((block, index) => (
                  <ReportBlockView key={`${block.type}-${block.title}-${index}`} block={block} />
                ))}
              </div>
            </div>
          ) : (
            <LockedPreview title={selectedCatalogItem?.title ?? "Расширенный отчет"} description="Этот отчет доступен в Premium вместе с PDF-экспортом." />
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}

function updateCustomRange(
  next: { from: string; to: string },
  setCustomDates: Dispatch<SetStateAction<{ from: string; to: string }>>,
  setRange: Dispatch<SetStateAction<DateRangeInput>>
) {
  setCustomDates(next);
  if (next.from && next.to) {
    setRange(buildCustomDateRange("7d", next.from, next.to));
  }
}

function ReportParameterControls({
  definitions,
  devices,
  value,
  onChange
}: {
  definitions: ReportParameterDefinition[];
  devices: Device[];
  value: ReportParameters;
  onChange: Dispatch<SetStateAction<ReportParameters>>;
}) {
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {definitions.map((definition) => {
        const options = getParameterOptions(definition, devices);
        return (
          <label key={definition.key} className="space-y-2 text-sm text-zinc-400">
            <span>{definition.label}</span>
            <Select
              value={value[definition.key] ?? ""}
              onChange={(event) => onChange((current) => ({ ...current, [definition.key]: event.target.value || null }))}
            >
              <option value="">Выберите</option>
              {options.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </label>
        );
      })}
    </div>
  );
}

function ReportBlockView({ block }: { block: ReportBlock }) {
  if (block.type === "metrics") {
    return (
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {block.items.map((item) => (
          <div key={item.label} className="rounded-2xl border border-white/10 bg-black/20 p-4">
            <p className="text-sm text-zinc-400">{item.label}</p>
            <p className="mt-2 break-words text-2xl font-semibold text-white">{item.value}</p>
            <p className="mt-1 text-sm text-zinc-500">{item.subtitle}</p>
          </div>
        ))}
      </div>
    );
  }

  if (block.type === "line_chart") {
    return (
      <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
        <p className="font-medium text-white">{block.title}</p>
        <p className="mt-1 text-sm text-zinc-400">{block.description}</p>
        <div className="mt-4 h-[300px]">
          <ChartSuspense>
            <ReportLineChart series={block.series} />
          </ChartSuspense>
        </div>
      </div>
    );
  }

  if (block.type === "bar_chart") {
    return (
      <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
        <p className="font-medium text-white">{block.title}</p>
        <p className="mt-1 text-sm text-zinc-400">{block.description}</p>
        <div className="mt-4 h-[280px]">
          <ChartSuspense>
            <ReportBarChart data={block.items} />
          </ChartSuspense>
        </div>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-white/10 bg-black/20">
      <div className="border-b border-white/10 p-4">
        <p className="font-medium text-white">{block.title}</p>
        <p className="mt-1 text-sm text-zinc-400">{block.description}</p>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-white/[0.03] text-zinc-400">
            <tr>
              {block.columns.map((column) => (
                <th key={column} className="px-4 py-3 font-medium">{column}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {block.rows.map((row, index) => (
              <tr key={`${block.title}-${index}`} className="border-t border-white/10 text-white">
                {row.map((cell, cellIndex) => (
                  <td key={`${cell}-${cellIndex}`} className="px-4 py-3">{cell}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ChartSuspense({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={<div className="h-full animate-pulse rounded-2xl bg-white/5" />}>
      {children}
    </Suspense>
  );
}

function withDefaultReportParameters(definitions: ReportParameterDefinition[], current: ReportParameters, devices: Device[]) {
  const next = { ...current };
  definitions.forEach((definition) => {
    if (next[definition.key]) {
      return;
    }
    const options = getParameterOptions(definition, devices);
    next[definition.key] =
      definition.key === "roomB" ? options.find((option) => option.value !== next.roomA)?.value ?? options[0]?.value ?? null : options[0]?.value ?? null;
  });
  return next;
}

function hasRequiredParameters(definitions: ReportParameterDefinition[], value: ReportParameters) {
  return definitions.every((definition) => !definition.required || Boolean(value[definition.key]));
}

function pickReportParameters(definitions: ReportParameterDefinition[], value: ReportParameters) {
  return definitions.reduce<ReportParameters>((result, definition) => {
    result[definition.key] = value[definition.key] ?? null;
    return result;
  }, {});
}

function getParameterOptions(definition: ReportParameterDefinition, devices: Device[]) {
  if (definition.kind === "device") {
    return devices.filter((device) => device.sourceKind === "manual").map((device) => ({ value: device.id, label: device.name }));
  }
  if (definition.kind === "sensor") {
    return devices.filter((device) => device.sourceKind !== "manual").map((device) => ({ value: device.id, label: device.name }));
  }
  return Array.from(new Set(devices.map((device) => device.room))).map((room) => ({ value: room, label: room }));
}
