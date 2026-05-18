import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { CloudSun, Plus, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { DeviceCard } from "@/entities/device/DeviceCard";
import { isHomeSensorDevice, isLegacyWeatherDevice, isManagedDevice, isWeatherDevice } from "@/entities/device/isWeatherDevice";
import { CreateDeviceModal } from "@/features/devices/CreateDeviceModal";
import { api } from "@/shared/api/http";
import { liveQueryOptions } from "@/shared/api/liveQuery";
import { queryKeys } from "@/shared/api/queryKeys";
import type { Device } from "@/shared/api/types";
import { Button } from "@/shared/ui/Button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/Card";
import { Input } from "@/shared/ui/Input";
import { Modal } from "@/shared/ui/Modal";
import { SectionTitle } from "@/widgets/dashboard/SectionTitle";

export function DevicesPage() {
  const [modalOpen, setModalOpen] = useState(false);
  const [editingDevice, setEditingDevice] = useState<Device | null>(null);
  const [deviceToDelete, setDeviceToDelete] = useState<Device | null>(null);
  const [search, setSearch] = useState("");
  const queryClient = useQueryClient();
  const devicesQuery = useQuery({ queryKey: queryKeys.devices, queryFn: api.devices, ...liveQueryOptions });
  const toggleMutation = useMutation({
    mutationFn: ({ id, enabled }: { id: string; enabled: boolean }) => api.updateDevice(id, { enabled }),
    onSuccess: invalidateDeviceQueries(queryClient)
  });
  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.deleteDevice(id),
    onSuccess: async () => {
      await invalidateDeviceQueries(queryClient)();
      setDeviceToDelete(null);
    }
  });

  const { outdoorSensors, homeSensors, managedDevices } = useMemo(() => {
    const source = devicesQuery.data?.devices ?? [];
    const matchesSearch = (device: Device) => `${device.name} ${device.category} ${device.room}`.toLowerCase().includes(search.toLowerCase());
    const outdoor = source.filter(isWeatherDevice).filter(matchesSearch);
    const home = source.filter(isHomeSensorDevice).filter(matchesSearch);
    const ordinary = source
      .filter((device) => isManagedDevice(device) && !isLegacyWeatherDevice(device))
      .filter((device) => `${device.name} ${device.category} ${device.room}`.toLowerCase().includes(search.toLowerCase()));

    return { outdoorSensors: outdoor, homeSensors: home, managedDevices: ordinary };
  }, [devicesQuery.data?.devices, search]);

  const formOpen = modalOpen || Boolean(editingDevice);

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <SectionTitle title="Устройства" description="Управляй подключенными устройствами дома" />
        <div className="flex w-full flex-col gap-3 sm:flex-row lg:w-auto">
          <div className="relative min-w-0 flex-1 lg:w-64">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
            <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Поиск устройства" className="pl-10" />
          </div>
          <Button onClick={() => setModalOpen(true)} className="w-full sm:w-auto">
            <Plus className="h-4 w-4" /> Добавить устройство
          </Button>
        </div>
      </div>

      {outdoorSensors.length > 0 ? (
        <section className="space-y-3">
          <div className="flex items-center gap-2 text-sm font-medium text-sky-200">
            <CloudSun className="h-4 w-4" />
            Уличные датчики
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {outdoorSensors.map((device) => (
              <DeviceCard key={device.id} device={device} readonly />
            ))}
          </div>
        </section>
      ) : null}

      {homeSensors.length > 0 ? (
        <section className="space-y-3">
          <p className="text-sm font-medium text-amber-200">Домашние датчики</p>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {homeSensors.map((device) => (
              <DeviceCard
                key={device.id}
                device={device}
                pending={toggleMutation.isPending || deleteMutation.isPending}
                onToggle={(enabled) => toggleMutation.mutate({ id: device.id, enabled })}
                onEdit={() => setEditingDevice(device)}
                onDelete={() => setDeviceToDelete(device)}
              />
            ))}
          </div>
        </section>
      ) : null}

      <section className="space-y-3">
        <p className="text-sm font-medium text-zinc-300">Устройства дома</p>
        {managedDevices.length > 0 ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {managedDevices.map((device) => (
              <DeviceCard
                key={device.id}
                device={device}
                pending={toggleMutation.isPending || deleteMutation.isPending}
                onToggle={(enabled) => toggleMutation.mutate({ id: device.id, enabled })}
                onEdit={() => setEditingDevice(device)}
                onDelete={() => setDeviceToDelete(device)}
              />
            ))}
          </div>
        ) : (
          <Card className="rounded-3xl">
            <CardHeader>
              <CardTitle>Устройства не найдены</CardTitle>
              <CardDescription>Измените поиск или добавьте новое устройство.</CardDescription>
            </CardHeader>
          </Card>
        )}
      </section>

      <CreateDeviceModal
        open={formOpen}
        device={editingDevice}
        onClose={() => {
          setModalOpen(false);
          setEditingDevice(null);
        }}
      />
      <Modal open={Boolean(deviceToDelete)} onClose={() => setDeviceToDelete(null)} title="Удалить устройство" description="Связанная телеметрия будет удалена вместе с устройством." maxWidth="max-w-md">
        <div className="space-y-4">
          <Card className="rounded-2xl">
            <CardContent>
              <p className="text-sm text-zinc-300">Удалить “{deviceToDelete?.name}”?</p>
            </CardContent>
          </Card>
          {deleteMutation.error ? <p className="rounded-2xl border border-red-400/20 bg-red-500/10 p-3 text-sm text-red-200">{deleteMutation.error.message}</p> : null}
          <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
            <Button variant="soft" onClick={() => setDeviceToDelete(null)}>
              Отмена
            </Button>
            <Button variant="danger" disabled={deleteMutation.isPending || !deviceToDelete} onClick={() => deviceToDelete && deleteMutation.mutate(deviceToDelete.id)}>
              Удалить
            </Button>
          </div>
        </div>
      </Modal>
    </motion.div>
  );
}

function invalidateDeviceQueries(queryClient: ReturnType<typeof useQueryClient>) {
  return async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.devices }),
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard }),
      queryClient.invalidateQueries({ queryKey: queryKeys.scenarios }),
      queryClient.invalidateQueries({ queryKey: queryKeys.telemetry }),
      queryClient.invalidateQueries({ queryKey: queryKeys.notifications })
    ]);
  };
}
