import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { api } from "@/shared/api/http";
import { queryKeys } from "@/shared/api/queryKeys";
import { getBackendStatusView } from "@/shared/lib/backendStatus";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/Card";
import { Switch } from "@/shared/ui/Switch";

export function SettingsPage() {
  const dashboard = useQuery({ queryKey: queryKeys.dashboard, queryFn: api.dashboard });
  const backend = dashboard.data?.backendStatus;
  const backendStatus = getBackendStatusView(backend);

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
      <Card className="rounded-3xl">
        <CardHeader>
          <CardTitle>Настройки</CardTitle>
          <CardDescription>Параметры интерфейса и интеграции с backend</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
            <p className="text-sm text-zinc-400">API Gateway</p>
            <div className="mt-3 space-y-1 font-mono text-sm text-white">
              <p>/api/devices</p>
              <p>/api/telemetry</p>
              <p>/api/scenarios</p>
              <p>/api/quick-actions</p>
            </div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm text-zinc-400">Collector</p>
                <p className={`mt-1 break-words text-sm ${backendStatus.textClassName}`}>{backendStatus.label} · {backendStatus.detail}</p>
              </div>
              <Switch checked={backendStatus.ok} />
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
