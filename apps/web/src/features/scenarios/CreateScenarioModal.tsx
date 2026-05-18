import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { api } from "@/shared/api/http";
import { isLegacyWeatherDevice, isScenarioSourceDevice } from "@/entities/device/isWeatherDevice";
import { queryKeys } from "@/shared/api/queryKeys";
import type {
  Device,
  DeviceSourceMetric,
  Scenario,
  ScenarioAction,
  ScenarioAutomationSource,
  ScenarioCommand,
  ScenarioMetric,
  ScenarioOperator,
  ScenarioTriggerType
} from "@/shared/api/types";
import { Button } from "@/shared/ui/Button";
import { Input } from "@/shared/ui/Input";
import { Modal } from "@/shared/ui/Modal";
import { Select } from "@/shared/ui/Select";
import { Switch } from "@/shared/ui/Switch";

const metrics: Array<{ label: ScenarioMetric; sourceMetric: string; unit: string | null }> = [
  { label: "Температура", sourceMetric: "temperature", unit: "°C" },
  { label: "Влажность", sourceMetric: "humidity", unit: "%" },
  { label: "Освещенность", sourceMetric: "illuminance", unit: "Вт/м²" },
  { label: "Осадки", sourceMetric: "precipitation", unit: "мм" },
  { label: "Скорость ветра", sourceMetric: "wind_speed", unit: "км/ч" },
  { label: "Движение", sourceMetric: "motion", unit: null },
  { label: "CO2", sourceMetric: "co2", unit: "ppm" },
  { label: "Выключатель", sourceMetric: "switch", unit: null }
];
const metricBySourceMetric = new Map(metrics.map((item) => [item.sourceMetric, item]));
const openMeteoSourceMetrics = new Map<DeviceSourceMetric, string>([
  ["temperature_2m", "temperature"],
  ["relative_humidity_2m", "humidity"],
  ["precipitation", "precipitation"],
  ["wind_speed_10m", "wind_speed"],
  ["shortwave_radiation", "illuminance"]
]);

type DraftAction = Omit<ScenarioAction, "id">;

export function CreateScenarioModal({ open, onClose, scenario }: { open: boolean; onClose: () => void; scenario?: Scenario | null }) {
  const queryClient = useQueryClient();
  const devicesQuery = useQuery({ queryKey: queryKeys.devices, queryFn: api.devices });
  const allDevices = (devicesQuery.data?.devices ?? []).filter((device) => !isLegacyWeatherDevice(device));
  const sourceDevices = allDevices.filter(isScenarioSourceDevice);
  const targetDevices = allDevices.filter((device) => !device.isSystem && device.sourceKind === "manual");
  const firstSourceDevice = sourceDevices[0];
  const firstTargetDevice = targetDevices[0];
  const [title, setTitle] = useState("");
  const [triggerType, setTriggerType] = useState<ScenarioTriggerType>("automatic");
  const [automationSource, setAutomationSource] = useState<ScenarioAutomationSource>("sensor");
  const [favorite, setFavorite] = useState(false);
  const [metric, setMetric] = useState<ScenarioMetric>("Температура");
  const [operator, setOperator] = useState<ScenarioOperator>(">");
  const [value, setValue] = useState("25");
  const [sourceDeviceId, setSourceDeviceId] = useState<string>("");
  const [targetDeviceId, setTargetDeviceId] = useState<string>("");
  const [command, setCommand] = useState<ScenarioCommand>("Включить");
  const [scheduleTime, setScheduleTime] = useState("07:30");
  const [active, setActive] = useState(true);
  const [actions, setActions] = useState<DraftAction[]>([]);
  const editing = Boolean(scenario);
  const selectedSource = useMemo(() => sourceDevices.find((device) => device.id === (sourceDeviceId || firstSourceDevice?.id)), [sourceDevices, firstSourceDevice?.id, sourceDeviceId]);
  const availableMetrics = useMemo(() => getMetricsForDevice(selectedSource), [selectedSource]);
  const metricConfig = availableMetrics.find((item) => item.label === metric) ?? availableMetrics[0] ?? metrics[0];
  const selectedTarget = useMemo(() => targetDevices.find((device) => device.id === (targetDeviceId || firstTargetDevice?.id)), [targetDevices, firstTargetDevice?.id, targetDeviceId]);

  useEffect(() => {
    if (!open) return;
    if (scenario) {
      setTitle(scenario.title);
      setTriggerType(scenario.triggerType);
      setAutomationSource(scenario.automationSource);
      setFavorite(scenario.favorite);
      setMetric(scenario.metric);
      setOperator(scenario.operator);
      setValue(String(scenario.value));
      setSourceDeviceId(scenario.sourceDeviceId ?? "");
      setTargetDeviceId(scenario.targetDeviceId ?? "");
      setCommand(scenario.command);
      setScheduleTime(scenario.scheduleTime ?? "07:30");
      setActive(scenario.active);
      setActions(scenario.actions.map(({ id: _id, ...action }) => action));
      return;
    }

    setTitle("");
    setTriggerType("automatic");
    setAutomationSource("sensor");
    setFavorite(false);
    setMetric("Температура");
    setOperator(">");
    setValue("25");
    setSourceDeviceId("");
    setTargetDeviceId("");
    setCommand("Включить");
    setScheduleTime("07:30");
    setActive(true);
    setActions([]);
  }, [open, scenario]);

  useEffect(() => {
    if (triggerType !== "automatic" || availableMetrics.length === 0) {
      return;
    }
    if (!availableMetrics.some((item) => item.label === metric)) {
      setMetric(availableMetrics[0].label);
    }
  }, [availableMetrics, metric, triggerType]);

  const mutation = useMutation({
    mutationFn: (input: {
      title: string;
      triggerType: ScenarioTriggerType;
      automationSource: ScenarioAutomationSource;
      favorite: boolean;
      metric: ScenarioMetric;
      operator: ScenarioOperator;
      value: number;
      unit: string | null;
      sourceDeviceId: string | null;
      sourceDeviceName: string | null;
      sourceMetric: string | null;
      scheduleTime: string | null;
      scheduleTimezone: string | null;
      targetDeviceId: string | null;
      targetDeviceName: string;
      command: ScenarioCommand;
      active: boolean;
      actions: DraftAction[];
    }) => (scenario ? api.updateScenario(scenario.id, input) : api.createScenario(input)),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.scenarios }),
        queryClient.invalidateQueries({ queryKey: queryKeys.dashboard }),
        queryClient.invalidateQueries({ queryKey: queryKeys.notifications })
      ]);
      onClose();
    }
  });

  function submit() {
    if (!title.trim()) return;
    mutation.mutate({
      title: title.trim(),
      triggerType,
      automationSource: triggerType === "automatic" ? automationSource : "sensor",
      favorite: triggerType === "manual" ? favorite : false,
      metric: triggerType === "automatic" && automationSource === "schedule" ? "Выключатель" : metric,
      operator: triggerType === "automatic" && automationSource === "schedule" ? "=" : operator,
      value: triggerType === "automatic" && automationSource === "schedule" ? 1 : Number(value),
      unit: triggerType === "automatic" && automationSource === "schedule" ? null : metricConfig.unit,
      sourceDeviceId: triggerType === "automatic" && automationSource === "sensor" ? selectedSource?.id ?? null : null,
      sourceDeviceName: triggerType === "automatic" && automationSource === "sensor" ? selectedSource?.name ?? null : null,
      sourceMetric: triggerType === "automatic" && automationSource === "sensor" ? metricConfig.sourceMetric : null,
      scheduleTime: triggerType === "automatic" && automationSource === "schedule" ? scheduleTime : null,
      scheduleTimezone: null,
      targetDeviceId: triggerType === "automatic" ? selectedTarget?.id ?? null : null,
      targetDeviceName: triggerType === "automatic" ? selectedTarget?.name ?? "Устройство" : "Несколько устройств",
      command,
      active,
      actions: triggerType === "manual" ? actions : []
    });
  }

  function addAction() {
    if (!firstTargetDevice) return;
    setActions((current) => [
      ...current,
      {
        targetDeviceId: firstTargetDevice.id,
        targetDeviceName: firstTargetDevice.name,
        command: "Включить",
        orderIndex: current.length
      }
    ]);
  }

  function updateAction(index: number, patch: Partial<DraftAction>) {
    setActions((current) =>
      current.map((action, currentIndex) => {
        if (currentIndex !== index) return action;
        const nextDevice = patch.targetDeviceId ? targetDevices.find((device) => device.id === patch.targetDeviceId) : null;
        return {
          ...action,
          ...patch,
          targetDeviceName: nextDevice?.name ?? patch.targetDeviceName ?? action.targetDeviceName
        };
      })
    );
  }

  function removeAction(index: number) {
    setActions((current) =>
      current
        .filter((_, currentIndex) => currentIndex !== index)
        .map((action, orderIndex) => ({
          ...action,
          orderIndex
        }))
    );
  }

  const submitDisabled =
    mutation.isPending ||
    !title.trim() ||
    (triggerType === "automatic" && !selectedTarget) ||
    (triggerType === "automatic" && automationSource === "sensor" && (!selectedSource || availableMetrics.length === 0)) ||
    (triggerType === "automatic" && automationSource === "schedule" && !/^\d{2}:\d{2}$/.test(scheduleTime)) ||
    (triggerType === "manual" && actions.length === 0);

  return (
    <Modal open={open} onClose={onClose} title={editing ? "Редактировать сценарий" : "Добавить сценарий"} description="Выберите источник данных или соберите ручной режим">
      <div className="grid gap-4">
        <div className="grid gap-2 sm:grid-cols-2">
          <Button variant={triggerType === "automatic" ? "primary" : "soft"} onClick={() => setTriggerType("automatic")}>
            Автоматический
          </Button>
          <Button variant={triggerType === "manual" ? "primary" : "soft"} onClick={() => setTriggerType("manual")}>
            Ручной режим
          </Button>
        </div>

        <div>
          <label className="mb-2 block text-sm text-zinc-400">Название сценария</label>
          <Input value={title} onChange={(event) => setTitle(event.target.value)} placeholder={triggerType === "automatic" ? "Например: Закрыть шторы вечером" : "Например: Кино"} />
        </div>

        {triggerType === "automatic" ? (
          <>
            <div className="grid gap-2 sm:grid-cols-2">
              <Button variant={automationSource === "sensor" ? "primary" : "soft"} onClick={() => setAutomationSource("sensor")}>
                Датчик
              </Button>
              <Button
                variant={automationSource === "schedule" ? "primary" : "soft"}
                onClick={() => {
                  setAutomationSource("schedule");
                  if (command === "Установить значение") {
                    setCommand("Включить");
                  }
                }}
              >
                Время
              </Button>
            </div>

            {automationSource === "sensor" ? (
              <>
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Источник">
                <Select value={selectedSource?.id ?? ""} onChange={(event) => setSourceDeviceId(event.target.value)}>
                  {sourceDevices.map((device) => (
                    <option key={device.id} value={device.id}>
                      {device.name}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Метрика">
                <Select value={metric} onChange={(event) => setMetric(event.target.value as ScenarioMetric)}>
                  {availableMetrics.map((item) => (
                    <option key={item.label} value={item.label}>
                      {item.label}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>

            <div className="grid gap-4 md:grid-cols-[0.7fr,0.8fr,0.8fr]">
              <Field label="Оператор">
                <Select value={operator} onChange={(event) => setOperator(event.target.value as ScenarioOperator)}>
                  <option value=">">Больше</option>
                  <option value="<">Меньше</option>
                  <option value="=">Равно</option>
                </Select>
              </Field>
              <Field label="Значение">
                <Input value={value} onChange={(event) => setValue(event.target.value)} />
              </Field>
              <Field label="Единица">
                <Input value={metricConfig.unit ?? "Без единицы"} disabled />
              </Field>
            </div>
              </>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Время запуска">
                  <Input type="time" value={scheduleTime} onChange={(event) => setScheduleTime(event.target.value)} />
                </Field>
                <Field label="Повтор">
                  <Input value="Каждый день" disabled />
                </Field>
              </div>
            )}

            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Целевое устройство">
                <Select value={selectedTarget?.id ?? ""} onChange={(event) => setTargetDeviceId(event.target.value)}>
                  {targetDevices.map((device) => (
                    <option key={device.id} value={device.id}>
                      {device.name}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Действие">
                <Select value={command} onChange={(event) => setCommand(event.target.value as ScenarioCommand)}>
                  <option value="Включить">Включить</option>
                  <option value="Выключить">Выключить</option>
                  <option value="Инвертировать">Инвертировать</option>
                  {automationSource === "sensor" ? <option value="Установить значение">Установить значение</option> : null}
                </Select>
              </Field>
            </div>
          </>
        ) : (
          <>
            <div className="flex items-center justify-between gap-4 rounded-2xl border border-white/10 bg-white/5 p-4">
              <div>
                <p className="font-medium text-white">Показывать на дашборде</p>
                <p className="text-sm text-zinc-400">Избранные режимы заменяют старые быстрые действия.</p>
              </div>
              <Switch checked={favorite} onCheckedChange={setFavorite} />
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm text-zinc-400">Действия режима</p>
                <Button type="button" variant="soft" onClick={addAction} disabled={!firstTargetDevice}>
                  <Plus className="h-4 w-4" /> Добавить действие
                </Button>
              </div>
              {actions.map((action, index) => (
                <div key={`${action.targetDeviceId}-${index}`} className="grid gap-3 rounded-2xl border border-white/10 bg-black/20 p-4 sm:grid-cols-[1fr,1fr,auto]">
                  <Select value={action.targetDeviceId ?? ""} onChange={(event) => updateAction(index, { targetDeviceId: event.target.value })}>
                    {targetDevices.map((device) => (
                      <option key={device.id} value={device.id}>
                        {device.name}
                      </option>
                    ))}
                  </Select>
                  <Select value={action.command} onChange={(event) => updateAction(index, { command: event.target.value as ScenarioCommand })}>
                    <option value="Включить">Включить</option>
                    <option value="Выключить">Выключить</option>
                    <option value="Инвертировать">Инвертировать</option>
                  </Select>
                  <Button type="button" variant="danger" onClick={() => removeAction(index)} className="h-11 px-3" title="Удалить действие">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              {actions.length === 0 ? <p className="rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-zinc-400">Добавьте хотя бы одно действие.</p> : null}
            </div>
          </>
        )}

        <div className="flex items-center justify-between gap-4 rounded-2xl border border-white/10 bg-white/5 p-4">
          <div>
            <p className="font-medium text-white">Сценарий активен</p>
            <p className="text-sm text-zinc-400">Выключите, если правило нужно сохранить без запуска.</p>
          </div>
          <Switch checked={active} onCheckedChange={setActive} />
        </div>

        {mutation.error ? <p className="rounded-2xl border border-red-400/20 bg-red-500/10 p-3 text-sm text-red-200">{mutation.error.message}</p> : null}

        <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:justify-end">
          <Button variant="soft" onClick={onClose}>
            Отмена
          </Button>
          <Button disabled={submitDisabled} onClick={submit}>
            {editing ? "Сохранить изменения" : "Сохранить сценарий"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function getMetricsForDevice(device?: Device) {
  if (!device?.sourceMetric) {
    return [];
  }

  const sourceMetric = device.sourceKind === "open_meteo" ? openMeteoSourceMetrics.get(device.sourceMetric) : device.sourceMetric;
  const metric = sourceMetric ? metricBySourceMetric.get(sourceMetric) : null;
  return metric ? [metric] : [];
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-2 block text-sm text-zinc-400">{label}</label>
      {children}
    </div>
  );
}
