import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { AlertCircle, CheckCircle2, LocateFixed, MapPin } from "lucide-react";
import { useState } from "react";
import { api } from "@/shared/api/http";
import { queryKeys } from "@/shared/api/queryKeys";
import { Button } from "@/shared/ui/Button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/Card";

export function SettingsPage() {
  const queryClient = useQueryClient();
  const location = useQuery({ queryKey: queryKeys.location, queryFn: api.location });
  const [geoError, setGeoError] = useState<string | null>(null);
  const saveLocation = useMutation({
    mutationFn: api.saveBrowserLocation,
    onSuccess: async () => {
      setGeoError(null);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.location }),
        queryClient.invalidateQueries({ queryKey: queryKeys.dashboard })
      ]);
    },
    onError: (error) => {
      setGeoError(error instanceof Error ? error.message : "Не удалось сохранить локацию");
    }
  });

  function requestBrowserLocation() {
    setGeoError(null);
    if (!navigator.geolocation) {
      setGeoError("Браузер не поддерживает геолокацию");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        saveLocation.mutate({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracyMeters: position.coords.accuracy ?? null,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "Europe/Moscow",
          label: "Дом"
        });
      },
      (error) => setGeoError(error.message || "Не удалось получить геолокацию"),
      { enableHighAccuracy: true, timeout: 12_000, maximumAge: 60_000 }
    );
  }

  const current = location.data?.location ?? null;

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
      <Card className="rounded-3xl">
        <CardHeader>
          <CardTitle>Настройки</CardTitle>
          <CardDescription>Параметры интерфейса, API и домашней локации</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 lg:grid-cols-[0.9fr,1.1fr]">
          <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
            <p className="text-sm text-zinc-400">API Gateway</p>
            <div className="mt-3 space-y-1 font-mono text-sm text-white">
              <p>/api/devices</p>
              <p>/api/location</p>
              <p>/api/telemetry</p>
              <p>/api/scenarios</p>
              <p>/api/scenarios/:id/run</p>
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-sky-200" />
                  <p className="font-medium text-white">Локация дома</p>
                </div>
                <p className="mt-2 text-sm text-zinc-400">
                  {current ? `${current.latitude.toFixed(5)}, ${current.longitude.toFixed(5)}` : "Локация пока не сохранена"}
                </p>
              </div>
              <Button type="button" variant="soft" onClick={requestBrowserLocation} disabled={saveLocation.isPending}>
                <LocateFixed className="h-4 w-4" /> {saveLocation.isPending ? "Сохраняем" : "Определить"}
              </Button>
            </div>

            {current ? (
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <LocationFact label="Точность" value={current.accuracyMeters === null ? "—" : `${Math.round(current.accuracyMeters)} м`} />
                <LocationFact label="Часовой пояс" value={current.timezone} />
                <LocationFact label="Обновлено" value={formatDateTime(current.updatedAt)} />
              </div>
            ) : null}

            {saveLocation.isSuccess ? (
              <p className="mt-4 flex items-center gap-2 rounded-2xl border border-emerald-400/20 bg-emerald-500/10 p-3 text-sm text-emerald-200">
                <CheckCircle2 className="h-4 w-4" /> Локация сохранена
              </p>
            ) : null}
            {geoError ? (
              <p className="mt-4 flex items-center gap-2 rounded-2xl border border-red-400/20 bg-red-500/10 p-3 text-sm text-red-200">
                <AlertCircle className="h-4 w-4" /> {geoError}
              </p>
            ) : null}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

function LocationFact({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-h-20 rounded-2xl border border-white/10 bg-white/[0.03] p-3">
      <p className="text-xs text-zinc-500">{label}</p>
      <p className="mt-2 break-words text-sm font-medium text-white">{value}</p>
    </div>
  );
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("ru-RU", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}
