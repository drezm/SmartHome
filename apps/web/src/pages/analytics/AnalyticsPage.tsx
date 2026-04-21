import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { NotificationRow } from "@/entities/notification/NotificationRow";
import { api } from "@/shared/api/http";
import { queryKeys } from "@/shared/api/queryKeys";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/Card";
import { SectionTitle } from "@/widgets/dashboard/SectionTitle";

export function AnalyticsPage() {
  const dashboard = useQuery({ queryKey: queryKeys.dashboard, queryFn: api.dashboard });
  const notifications = useQuery({ queryKey: queryKeys.notifications, queryFn: api.notifications });

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
    </motion.div>
  );
}
