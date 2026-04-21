import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { api } from "@/shared/api/http";
import { queryKeys } from "@/shared/api/queryKeys";
import type { DeviceCategory, DeviceType } from "@/shared/api/types";
import { Button } from "@/shared/ui/Button";
import { Input } from "@/shared/ui/Input";
import { Modal } from "@/shared/ui/Modal";
import { Select } from "@/shared/ui/Select";
import { Switch } from "@/shared/ui/Switch";
import { deviceTypeOptions } from "@/entities/device/deviceIcon";
import { cn } from "@/shared/lib/cn";

const rooms = ["Гостиная", "Кухня", "Спальня", "Коридор", "Кабинет"];

export function CreateDeviceModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [step, setStep] = useState(1);
  const [selectedType, setSelectedType] = useState<DeviceType | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<DeviceCategory | null>(null);
  const [name, setName] = useState("");
  const [room, setRoom] = useState("Гостиная");
  const [enabled, setEnabled] = useState(true);

  const mutation = useMutation({
    mutationFn: api.createDevice,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.devices }),
        queryClient.invalidateQueries({ queryKey: queryKeys.dashboard }),
        queryClient.invalidateQueries({ queryKey: queryKeys.notifications })
      ]);
      reset();
      onClose();
    }
  });

  function reset() {
    setStep(1);
    setSelectedType(null);
    setSelectedCategory(null);
    setName("");
    setRoom("Гостиная");
    setEnabled(true);
  }

  function submit() {
    if (!selectedType || !selectedCategory || !name.trim()) return;
    mutation.mutate({ name: name.trim(), type: selectedType, category: selectedCategory, room, enabled });
  }

  return (
    <Modal open={open} onClose={onClose} title="Добавить устройство" description="Подключение нового устройства в несколько шагов">
      <div className="mb-6 flex items-center justify-between gap-3">
        {[1, 2, 3].map((item) => (
          <div key={item} className="flex flex-1 items-center gap-3">
            <div className={cn("flex h-8 w-8 items-center justify-center rounded-full text-sm", step >= item ? "bg-violet-600 text-white" : "bg-white/5 text-zinc-400")}>{item}</div>
            {item < 3 ? <div className={cn("h-px flex-1", step > item ? "bg-violet-500" : "bg-white/10")} /> : null}
          </div>
        ))}
      </div>

      {step === 1 ? (
        <div>
          <p className="mb-4 text-sm text-zinc-400">Выберите тип устройства</p>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {deviceTypeOptions.map((option) => {
              const Icon = option.icon;
              const selected = selectedType === option.type && selectedCategory === option.category;

              return (
                <button
                  key={`${option.type}-${option.category}`}
                  onClick={() => {
                    setSelectedType(option.type);
                    setSelectedCategory(option.category);
                  }}
                  className={cn("rounded-2xl border p-4 text-left transition", selected ? "border-violet-400/40 bg-violet-500/10" : "border-white/10 bg-white/5 hover:bg-white/10")}
                >
                  <div className="mb-4 w-fit rounded-2xl bg-black/20 p-3">
                    <Icon className="h-5 w-5 text-violet-300" />
                  </div>
                  <p className="font-medium text-white">{option.label}</p>
                  <p className="mt-1 text-sm text-zinc-400">{option.subtitle}</p>
                </button>
              );
            })}
          </div>
          <div className="mt-6 flex justify-end">
            <Button disabled={!selectedType} onClick={() => setStep(2)}>
              Далее
            </Button>
          </div>
        </div>
      ) : null}

      {step === 2 ? (
        <div className="space-y-4">
          <Input value={name} onChange={(event) => setName(event.target.value)} placeholder="Название устройства" />
          <Select value={room} onChange={(event) => setRoom(event.target.value)}>
            {rooms.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </Select>
          <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 p-4">
            <div>
              <p className="text-white">Автоматически включить после добавления</p>
              <p className="mt-1 text-sm text-zinc-400">Устройство сразу станет активным в системе</p>
            </div>
            <Switch checked={enabled} onCheckedChange={setEnabled} />
          </div>
          <div className="flex justify-between">
            <Button variant="soft" onClick={() => setStep(1)}>
              Назад
            </Button>
            <Button disabled={!name.trim()} onClick={() => setStep(3)}>
              Далее
            </Button>
          </div>
        </div>
      ) : null}

      {step === 3 ? (
        <div className="space-y-4">
          <Summary label="Тип" value={selectedCategory ?? "—"} />
          <Summary label="Название" value={name || "—"} />
          <Summary label="Комната" value={room} />
          {mutation.error ? <p className="rounded-2xl border border-red-400/20 bg-red-500/10 p-3 text-sm text-red-200">{mutation.error.message}</p> : null}
          <div className="flex justify-between">
            <Button variant="soft" onClick={() => setStep(2)}>
              Назад
            </Button>
            <Button disabled={mutation.isPending} onClick={submit}>
              Добавить устройство
            </Button>
          </div>
        </div>
      ) : null}
    </Modal>
  );
}

function Summary({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
      <p className="text-sm text-zinc-400">{label}</p>
      <p className="mt-1 text-white">{value}</p>
    </div>
  );
}
