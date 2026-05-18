import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { CloudSun, Cpu, Home, Lightbulb, Shield, Thermometer, Wind } from "lucide-react";
import { api } from "@/shared/api/http";
import { queryKeys } from "@/shared/api/queryKeys";
import type {
  Device,
  DeviceCategory,
  DeviceSourceKind,
  DeviceSourceMetric,
  DeviceType,
  HomeSensorMetric,
  OpenMeteoMetric
} from "@/shared/api/types";
import { Button } from "@/shared/ui/Button";
import { Input } from "@/shared/ui/Input";
import { Modal } from "@/shared/ui/Modal";
import { Select } from "@/shared/ui/Select";
import { Switch } from "@/shared/ui/Switch";
import { deviceTypeOptions } from "@/entities/device/deviceIcon";
import { cn } from "@/shared/lib/cn";

const rooms = ["Гостиная", "Кухня", "Спальня", "Коридор", "Кабинет"];
const openMeteoOptions: Array<{
  metric: OpenMeteoMetric;
  title: string;
  subtitle: string;
  type: DeviceType;
  category: DeviceCategory;
  icon: typeof Thermometer;
}> = [
  { metric: "temperature_2m", title: "Температура снаружи", subtitle: "Температура воздуха", type: "TEMPERATURE_SENSOR", category: "Датчики", icon: Thermometer },
  { metric: "relative_humidity_2m", title: "Влажность снаружи", subtitle: "Относительная влажность", type: "CLIMATE_SENSOR", category: "Климат", icon: CloudSun },
  { metric: "precipitation", title: "Осадки снаружи", subtitle: "Текущие осадки", type: "CLIMATE_SENSOR", category: "Климат", icon: CloudSun },
  { metric: "wind_speed_10m", title: "Ветер снаружи", subtitle: "Скорость ветра", type: "CLIMATE_SENSOR", category: "Климат", icon: Wind },
  { metric: "shortwave_radiation", title: "Освещенность снаружи", subtitle: "Солнечная радиация", type: "LIGHT_SENSOR", category: "Датчики", icon: Lightbulb }
];
const homeSensorOptions: Array<{
  metric: HomeSensorMetric;
  title: string;
  subtitle: string;
  defaultName: string;
  type: DeviceType;
  category: DeviceCategory;
  icon: typeof Thermometer;
}> = [
  { metric: "temperature", title: "Температура", subtitle: "Температура внутри дома", defaultName: "Датчик температуры", type: "TEMPERATURE_SENSOR", category: "Датчики", icon: Thermometer },
  { metric: "humidity", title: "Влажность", subtitle: "Влажность в комнате", defaultName: "Датчик влажности", type: "CLIMATE_SENSOR", category: "Датчики", icon: CloudSun },
  { metric: "illuminance", title: "Освещенность", subtitle: "Уровень света в помещении", defaultName: "Датчик освещенности", type: "LIGHT_SENSOR", category: "Датчики", icon: Lightbulb },
  { metric: "motion", title: "Движение", subtitle: "Фиксация движения", defaultName: "Датчик движения", type: "MOTION_SENSOR", category: "Безопасность", icon: Shield },
  { metric: "co2", title: "CO2", subtitle: "Качество воздуха", defaultName: "Датчик CO2", type: "CLIMATE_SENSOR", category: "Датчики", icon: Wind },
  { metric: "switch", title: "Выключатель", subtitle: "Состояние контакта", defaultName: "Датчик выключателя", type: "SWITCH_SENSOR", category: "Датчики", icon: Cpu }
];

export function CreateDeviceModal({ open, onClose, device }: { open: boolean; onClose: () => void; device?: Device | null }) {
  const queryClient = useQueryClient();
  const editing = Boolean(device);
  const [step, setStep] = useState(1);
  const [sourceKind, setSourceKind] = useState<DeviceSourceKind>("manual");
  const [sourceMetric, setSourceMetric] = useState<DeviceSourceMetric | null>(null);
  const [selectedType, setSelectedType] = useState<DeviceType | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<DeviceCategory | null>(null);
  const [name, setName] = useState("");
  const [room, setRoom] = useState("Гостиная");
  const [enabled, setEnabled] = useState(true);

  useEffect(() => {
    if (!open) return;
    if (device) {
      setStep(3);
      setSourceKind(device.sourceKind);
      setSourceMetric(device.sourceMetric);
      setSelectedType(device.type);
      setSelectedCategory(device.category);
      setName(device.name);
      setRoom(rooms.includes(device.room) ? device.room : "Гостиная");
      setEnabled(device.enabled);
      return;
    }

    reset();
  }, [open, device]);

  const mutation = useMutation({
    mutationFn: (input: {
      name: string;
      type: DeviceType;
      category: DeviceCategory;
      room: string;
      enabled: boolean;
      sourceKind?: DeviceSourceKind;
      sourceMetric?: DeviceSourceMetric | null;
    }) => (device ? api.updateDevice(device.id, input) : api.createDevice(input)),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.devices }),
        queryClient.invalidateQueries({ queryKey: queryKeys.dashboard }),
        queryClient.invalidateQueries({ queryKey: queryKeys.notifications }),
        queryClient.invalidateQueries({ queryKey: queryKeys.scenarios })
      ]);
      reset();
      onClose();
    }
  });

  function reset() {
    setStep(1);
    setSourceKind("manual");
    setSourceMetric(null);
    setSelectedType(null);
    setSelectedCategory(null);
    setName("");
    setRoom("Гостиная");
    setEnabled(true);
  }

  function chooseOpenMeteoMetric(metric: OpenMeteoMetric) {
    const option = openMeteoOptions.find((item) => item.metric === metric);
    if (!option) return;
    setSourceMetric(metric);
    setSelectedType(option.type);
    setSelectedCategory(option.category);
    setName(option.title);
    setRoom("Улица");
    setEnabled(true);
  }

  function chooseHomeSensorMetric(metric: HomeSensorMetric) {
    const option = homeSensorOptions.find((item) => item.metric === metric);
    if (!option) return;
    setSourceMetric(metric);
    setSelectedType(option.type);
    setSelectedCategory(option.category);
    setName(option.defaultName);
    setRoom("Гостиная");
    setEnabled(true);
  }

  function submit() {
    if (!selectedType || !selectedCategory || !name.trim()) return;
    mutation.mutate({
      name: name.trim(),
      type: selectedType,
      category: selectedCategory,
      room,
      enabled,
      sourceKind,
      sourceMetric
    });
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editing ? "Редактировать устройство" : "Добавить устройство"}
      description={editing ? "Измените параметры устройства дома" : "Сначала выберите, откуда устройство получает данные"}
    >
      {editing ? (
        sourceKind === "home_sensor" ? (
          <HomeSensorDetailsForm
            name={name}
            room={room}
            enabled={enabled}
            metric={sourceMetric as HomeSensorMetric | null}
            pending={mutation.isPending}
            error={mutation.error?.message}
            submitLabel="Сохранить изменения"
            onNameChange={setName}
            onRoomChange={setRoom}
            onEnabledChange={setEnabled}
            onSubmit={submit}
          />
        ) : (
          <DeviceDetailsForm
            name={name}
            room={room}
            enabled={enabled}
            selectedType={selectedType}
            selectedCategory={selectedCategory}
            pending={mutation.isPending}
            error={mutation.error?.message}
            submitLabel="Сохранить изменения"
            onNameChange={setName}
            onRoomChange={setRoom}
            onEnabledChange={setEnabled}
            onTypeChange={(type, category) => {
              setSelectedType(type);
              setSelectedCategory(category);
            }}
            onSubmit={submit}
          />
        )
      ) : (
        <>
          <ProgressSteps step={step} />
          {step === 1 ? <SourcePicker value={sourceKind} onChange={setSourceKind} onNext={() => setStep(2)} /> : null}
          {step === 2 && sourceKind === "manual" ? (
            <DeviceTypePicker
              selectedType={selectedType}
              selectedCategory={selectedCategory}
              onChange={(type, category) => {
                setSelectedType(type);
                setSelectedCategory(category);
              }}
              onBack={() => setStep(1)}
              onNext={() => setStep(3)}
            />
          ) : null}
          {step === 2 && sourceKind === "open_meteo" ? (
            <OpenMeteoPicker selectedMetric={sourceMetric as OpenMeteoMetric | null} onChange={chooseOpenMeteoMetric} onBack={() => setStep(1)} onNext={() => setStep(3)} />
          ) : null}
          {step === 2 && sourceKind === "home_sensor" ? (
            <HomeSensorPicker selectedMetric={sourceMetric as HomeSensorMetric | null} onChange={chooseHomeSensorMetric} onBack={() => setStep(1)} onNext={() => setStep(3)} />
          ) : null}
          {step === 3 && sourceKind === "manual" ? (
            <DeviceDetailsForm
              name={name}
              room={room}
              enabled={enabled}
              selectedType={selectedType}
              selectedCategory={selectedCategory}
              pending={mutation.isPending}
              error={mutation.error?.message}
              submitLabel="Добавить устройство"
              onNameChange={setName}
              onRoomChange={setRoom}
              onEnabledChange={setEnabled}
              onTypeChange={(type, category) => {
                setSelectedType(type);
                setSelectedCategory(category);
              }}
              onBack={() => setStep(2)}
              onSubmit={submit}
            />
          ) : null}
          {step === 3 && sourceKind === "open_meteo" ? (
            <div className="space-y-4">
              <Summary label="Источник" value="Open-Meteo" />
              <Summary label="Датчик" value={name || "—"} />
              <Summary label="Комната" value="Улица" />
              {mutation.error ? <p className="rounded-2xl border border-red-400/20 bg-red-500/10 p-3 text-sm text-red-200">{mutation.error.message}</p> : null}
              <div className="flex justify-between">
                <Button variant="soft" onClick={() => setStep(2)}>
                  Назад
                </Button>
                <Button disabled={mutation.isPending || !sourceMetric} onClick={submit}>
                  Добавить датчик
                </Button>
              </div>
            </div>
          ) : null}
          {step === 3 && sourceKind === "home_sensor" ? (
            <HomeSensorDetailsForm
              name={name}
              room={room}
              enabled={enabled}
              metric={sourceMetric as HomeSensorMetric | null}
              pending={mutation.isPending}
              error={mutation.error?.message}
              submitLabel="Добавить датчик"
              onNameChange={setName}
              onRoomChange={setRoom}
              onEnabledChange={setEnabled}
              onBack={() => setStep(2)}
              onSubmit={submit}
            />
          ) : null}
        </>
      )}
    </Modal>
  );
}

function ProgressSteps({ step }: { step: number }) {
  return (
    <div className="mb-6 flex items-center justify-between gap-3">
      {[1, 2, 3].map((item) => (
        <div key={item} className="flex flex-1 items-center gap-3">
          <div className={cn("flex h-8 w-8 items-center justify-center rounded-full text-sm", step >= item ? "bg-violet-600 text-white" : "bg-white/5 text-zinc-400")}>{item}</div>
          {item < 3 ? <div className={cn("h-px flex-1", step > item ? "bg-violet-500" : "bg-white/10")} /> : null}
        </div>
      ))}
    </div>
  );
}

function SourcePicker({ value, onChange, onNext }: { value: DeviceSourceKind; onChange: (value: DeviceSourceKind) => void; onNext: () => void }) {
  const options = [
    { value: "manual" as const, title: "Устройство", subtitle: "Лампа, розетка, кондиционер", icon: Home },
    { value: "home_sensor" as const, title: "Домашний датчик", subtitle: "Температура, движение, освещенность внутри дома", icon: Thermometer },
    { value: "open_meteo" as const, title: "Уличный датчик", subtitle: "Погода снаружи по домашней локации", icon: CloudSun }
  ];

  return (
    <div>
      <p className="mb-4 text-sm text-zinc-400">Откуда устройство берет данные</p>
      <div className="grid gap-4 md:grid-cols-3">
        {options.map((option) => {
          const Icon = option.icon;
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => onChange(option.value)}
              className={cn(
                "rounded-2xl border p-4 text-left transition",
                value === option.value ? "border-violet-400/40 bg-violet-500/15" : "border-white/10 bg-black/20 hover:bg-white/10"
              )}
            >
              <div className="mb-4 w-fit rounded-2xl bg-black/20 p-3">
                <Icon className="h-5 w-5 text-violet-300" />
              </div>
              <p className="font-medium text-white">{option.title}</p>
              <p className="mt-1 text-sm text-zinc-400">{option.subtitle}</p>
            </button>
          );
        })}
      </div>
      <div className="mt-6 flex justify-end">
        <Button onClick={onNext}>Далее</Button>
      </div>
    </div>
  );
}

function HomeSensorPicker({
  selectedMetric,
  onChange,
  onBack,
  onNext
}: {
  selectedMetric: HomeSensorMetric | null;
  onChange: (metric: HomeSensorMetric) => void;
  onBack: () => void;
  onNext: () => void;
}) {
  return (
    <div>
      <p className="mb-4 text-sm text-zinc-400">Выберите тип домашнего датчика</p>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {homeSensorOptions.map((option) => {
          const Icon = option.icon;
          return (
            <button
              key={option.metric}
              type="button"
              onClick={() => onChange(option.metric)}
              className={cn("rounded-2xl border p-4 text-left transition", selectedMetric === option.metric ? "border-violet-400/40 bg-violet-500/15" : "border-white/10 bg-black/20 hover:bg-white/10")}
            >
              <div className="mb-4 w-fit rounded-2xl bg-violet-500/15 p-3">
                <Icon className="h-5 w-5 text-violet-300" />
              </div>
              <p className="font-medium text-white">{option.title}</p>
              <p className="mt-1 text-sm text-zinc-400">{option.subtitle}</p>
            </button>
          );
        })}
      </div>
      <div className="mt-6 flex justify-between">
        <Button variant="soft" onClick={onBack}>
          Назад
        </Button>
        <Button disabled={!selectedMetric} onClick={onNext}>
          Далее
        </Button>
      </div>
    </div>
  );
}

function OpenMeteoPicker({
  selectedMetric,
  onChange,
  onBack,
  onNext
}: {
  selectedMetric: OpenMeteoMetric | null;
  onChange: (metric: OpenMeteoMetric) => void;
  onBack: () => void;
  onNext: () => void;
}) {
  return (
    <div>
      <p className="mb-4 text-sm text-zinc-400">Выберите внешний датчик</p>
      <div className="grid gap-4 sm:grid-cols-2">
        {openMeteoOptions.map((option) => {
          const Icon = option.icon;
          return (
            <button
              key={option.metric}
              type="button"
              onClick={() => onChange(option.metric)}
              className={cn("rounded-2xl border p-4 text-left transition", selectedMetric === option.metric ? "border-violet-400/40 bg-violet-500/10" : "border-white/10 bg-white/5 hover:bg-white/10")}
            >
              <div className="mb-4 w-fit rounded-2xl bg-black/20 p-3">
                <Icon className="h-5 w-5 text-violet-300" />
              </div>
              <p className="font-medium text-white">{option.title}</p>
              <p className="mt-1 text-sm text-zinc-400">{option.subtitle}</p>
            </button>
          );
        })}
      </div>
      <div className="mt-6 flex justify-between">
        <Button variant="soft" onClick={onBack}>
          Назад
        </Button>
        <Button disabled={!selectedMetric} onClick={onNext}>
          Далее
        </Button>
      </div>
    </div>
  );
}

function HomeSensorDetailsForm({
  name,
  room,
  enabled,
  metric,
  pending,
  error,
  submitLabel,
  onNameChange,
  onRoomChange,
  onEnabledChange,
  onBack,
  onSubmit
}: {
  name: string;
  room: string;
  enabled: boolean;
  metric: HomeSensorMetric | null;
  pending: boolean;
  error?: string;
  submitLabel: string;
  onNameChange: (value: string) => void;
  onRoomChange: (value: string) => void;
  onEnabledChange: (value: boolean) => void;
  onBack?: () => void;
  onSubmit: () => void;
}) {
  const selected = homeSensorOptions.find((option) => option.metric === metric);
  return (
    <div className="space-y-4">
      <Summary label="Тип датчика" value={selected?.title ?? "—"} />
      <Input value={name} onChange={(event) => onNameChange(event.target.value)} placeholder="Название датчика" />
      <Select value={room} onChange={(event) => onRoomChange(event.target.value)}>
        {rooms.map((item) => (
          <option key={item} value={item}>
            {item}
          </option>
        ))}
      </Select>
      <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 p-4">
        <div>
          <p className="text-white">Датчик включен</p>
          <p className="mt-1 text-sm text-zinc-400">Показания будут доступны в карточке и сценариях.</p>
        </div>
        <Switch checked={enabled} onCheckedChange={onEnabledChange} />
      </div>
      {error ? <p className="rounded-2xl border border-red-400/20 bg-red-500/10 p-3 text-sm text-red-200">{error}</p> : null}
      <div className={cn("flex", onBack ? "justify-between" : "justify-end")}>
        {onBack ? (
          <Button variant="soft" onClick={onBack}>
            Назад
          </Button>
        ) : null}
        <Button disabled={pending || !metric || !name.trim()} onClick={onSubmit}>
          {submitLabel}
        </Button>
      </div>
    </div>
  );
}

function DeviceTypePicker({
  selectedType,
  selectedCategory,
  onChange,
  onBack,
  onNext
}: {
  selectedType: DeviceType | null;
  selectedCategory: DeviceCategory | null;
  onChange: (type: DeviceType, category: DeviceCategory) => void;
  onBack: () => void;
  onNext: () => void;
}) {
  return (
    <div>
      <p className="mb-4 text-sm text-zinc-400">Выберите тип устройства</p>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {deviceTypeOptions.map((option) => {
          const Icon = option.icon;
          const selected = selectedType === option.type && selectedCategory === option.category;
          return (
            <button
              key={`${option.type}-${option.category}`}
              type="button"
              onClick={() => onChange(option.type, option.category)}
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
      <div className="mt-6 flex justify-between">
        <Button variant="soft" onClick={onBack}>
          Назад
        </Button>
        <Button disabled={!selectedType} onClick={onNext}>
          Далее
        </Button>
      </div>
    </div>
  );
}

function DeviceDetailsForm({
  name,
  room,
  enabled,
  selectedType,
  selectedCategory,
  pending,
  error,
  submitLabel,
  onNameChange,
  onRoomChange,
  onEnabledChange,
  onTypeChange,
  onBack,
  onSubmit
}: {
  name: string;
  room: string;
  enabled: boolean;
  selectedType: DeviceType | null;
  selectedCategory: DeviceCategory | null;
  pending: boolean;
  error?: string;
  submitLabel: string;
  onNameChange: (value: string) => void;
  onRoomChange: (value: string) => void;
  onEnabledChange: (value: boolean) => void;
  onTypeChange: (type: DeviceType, category: DeviceCategory) => void;
  onBack?: () => void;
  onSubmit: () => void;
}) {
  const selectedOption = deviceTypeOptions.find((option) => option.type === selectedType && option.category === selectedCategory);
  return (
    <div className="space-y-4">
      <Input value={name} onChange={(event) => onNameChange(event.target.value)} placeholder="Название устройства" />
      <Select
        value={selectedOption ? `${selectedOption.type}:${selectedOption.category}` : ""}
        onChange={(event) => {
          const option = deviceTypeOptions.find((item) => `${item.type}:${item.category}` === event.target.value);
          if (option) onTypeChange(option.type, option.category);
        }}
      >
        <option value="" disabled>
          Тип устройства
        </option>
        {deviceTypeOptions.map((option) => (
          <option key={`${option.type}-${option.category}`} value={`${option.type}:${option.category}`}>
            {option.label}
          </option>
        ))}
      </Select>
      <Select value={room} onChange={(event) => onRoomChange(event.target.value)}>
        {rooms.map((item) => (
          <option key={item} value={item}>
            {item}
          </option>
        ))}
      </Select>
      <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 p-4">
        <div>
          <p className="text-white">Устройство включено</p>
          <p className="mt-1 text-sm text-zinc-400">Состояние будет видно на карточке и в сценариях.</p>
        </div>
        <Switch checked={enabled} onCheckedChange={onEnabledChange} />
      </div>
      {error ? <p className="rounded-2xl border border-red-400/20 bg-red-500/10 p-3 text-sm text-red-200">{error}</p> : null}
      <div className={cn("flex", onBack ? "justify-between" : "justify-end")}>
        {onBack ? (
          <Button variant="soft" onClick={onBack}>
            Назад
          </Button>
        ) : null}
        <Button disabled={pending || !selectedType || !selectedCategory || !name.trim()} onClick={onSubmit}>
          {submitLabel}
        </Button>
      </div>
    </div>
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
