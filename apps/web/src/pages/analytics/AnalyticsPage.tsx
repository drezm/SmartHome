import { useMutation, useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Download } from "lucide-react";
import { useState } from "react";
import { Area, AreaChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { NotificationRow } from "@/entities/notification/NotificationRow";
import { api } from "@/shared/api/http";
import { queryKeys } from "@/shared/api/queryKeys";
import { Button } from "@/shared/ui/Button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/Card";
import { LockedPreview } from "@/shared/ui/LockedPreview";
import { SectionTitle } from "@/widgets/dashboard/SectionTitle";

export function AnalyticsPage() {
  const [range, setRange] = useState<"7d" | "30d">("7d");
  const dashboard = useQuery({ queryKey: queryKeys.dashboard, queryFn: api.dashboard });
  const notifications = useQuery({ queryKey: queryKeys.notifications, queryFn: api.notifications });
  const report = useQuery({ queryKey: queryKeys.report(range), queryFn: () => api.report(range), enabled: dashboard.data?.subscription?.isPremium === true });
  const download = useMutation({
    mutationFn: () => api.reportPdf(range),
    onSuccess: (blob) => {
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `smart-home-report-${range}.pdf`;
      link.click();
      URL.revokeObjectURL(url);
    }
  });
  const isPremium = dashboard.data?.subscription?.isPremium;

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
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={dashboard.data?.activitySeries ?? []}>
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

      {isPremium ? (
        <Card className="rounded-3xl">
          <CardHeader>
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <CardTitle>Premium Home Insights</CardTitle>
                <CardDescription>{report.data?.report.summary ?? "Расширенная аналитика по дому, сценариям и уведомлениям"}</CardDescription>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Button variant={range === "7d" ? "primary" : "soft"} onClick={() => setRange("7d")}>7 дней</Button>
                <Button variant={range === "30d" ? "primary" : "soft"} onClick={() => setRange("30d")}>30 дней</Button>
                <Button variant="soft" onClick={() => download.mutate()} disabled={download.isPending}>
                  <Download className="h-4 w-4" /> Скачать PDF
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="grid gap-6 xl:grid-cols-[1.4fr,1fr]">
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={report.data?.report.temperatureSeries ?? []}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                  <XAxis dataKey="time" stroke="#a1a1aa" />
                  <YAxis stroke="#a1a1aa" />
                  <Tooltip contentStyle={{ background: "#111216", border: "1px solid rgba(255,255,255,0.08)", color: "#fff" }} />
                  <Line type="monotone" dataKey="value" stroke="#10b981" strokeWidth={3} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <div className="space-y-3">
              {(report.data?.report.deviceActivity ?? []).slice(0, 6).map((device) => (
                <div key={device.name} className="flex items-center justify-between rounded-2xl border border-white/10 bg-black/20 p-3">
                  <span className="text-sm text-white">{device.name}</span>
                  <span className="text-sm text-zinc-400">{device.events} событий</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : (
        <LockedPreview title="Расширенная аналитика и PDF" description="Premium добавляет графики за 7/30 дней, отчеты по устройствам, сценариям, уведомлениям и выгрузку в PDF." />
      )}
    </motion.div>
  );
}
