import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Plus, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { DeviceCard } from "@/entities/device/DeviceCard";
import { CreateDeviceModal } from "@/features/devices/CreateDeviceModal";
import { api } from "@/shared/api/http";
import { queryKeys } from "@/shared/api/queryKeys";
import { Button } from "@/shared/ui/Button";
import { Input } from "@/shared/ui/Input";
import { SectionTitle } from "@/widgets/dashboard/SectionTitle";

export function DevicesPage() {
  const [modalOpen, setModalOpen] = useState(false);
  const [search, setSearch] = useState("");
  const queryClient = useQueryClient();
  const devicesQuery = useQuery({ queryKey: queryKeys.devices, queryFn: api.devices });
  const mutation = useMutation({
    mutationFn: ({ id, enabled }: { id: string; enabled: boolean }) => api.updateDevice(id, { enabled }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.devices }),
        queryClient.invalidateQueries({ queryKey: queryKeys.dashboard }),
        queryClient.invalidateQueries({ queryKey: queryKeys.notifications })
      ]);
    }
  });

  const devices = useMemo(() => {
    const source = devicesQuery.data?.devices ?? [];
    return source.filter((device) => `${device.name} ${device.category} ${device.room}`.toLowerCase().includes(search.toLowerCase()));
  }, [devicesQuery.data?.devices, search]);

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

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {devices.map((device) => (
          <DeviceCard key={device.id} device={device} pending={mutation.isPending} onToggle={(enabled) => mutation.mutate({ id: device.id, enabled })} />
        ))}
      </div>

      <CreateDeviceModal open={modalOpen} onClose={() => setModalOpen(false)} />
    </motion.div>
  );
}
