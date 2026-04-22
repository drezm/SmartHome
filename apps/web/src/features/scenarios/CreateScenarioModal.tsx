import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { api } from "@/shared/api/http";
import { queryKeys } from "@/shared/api/queryKeys";
import type { Scenario, ScenarioCommand, ScenarioMetric, ScenarioOperator } from "@/shared/api/types";
import { Button } from "@/shared/ui/Button";
import { Input } from "@/shared/ui/Input";
import { Modal } from "@/shared/ui/Modal";
import { Select } from "@/shared/ui/Select";
import { Switch } from "@/shared/ui/Switch";

export function CreateScenarioModal({ open, onClose, scenario }: { open: boolean; onClose: () => void; scenario?: Scenario | null }) {
  const queryClient = useQueryClient();
  const devicesQuery = useQuery({ queryKey: queryKeys.devices, queryFn: api.devices });
  const devices = devicesQuery.data?.devices ?? [];
  const firstDevice = devices[0];
  const [title, setTitle] = useState("");
  const [metric, setMetric] = useState<ScenarioMetric>("Температура");
  const [operator, setOperator] = useState<ScenarioOperator>(">");
  const [value, setValue] = useState("25");
  const [unit, setUnit] = useState("°C");
  const [targetDeviceId, setTargetDeviceId] = useState<string>("");
  const [command, setCommand] = useState<ScenarioCommand>("Включить");
  const [active, setActive] = useState(true);
  const editing = Boolean(scenario);

  const selectedDevice = useMemo(() => devices.find((device) => device.id === (targetDeviceId || firstDevice?.id)), [devices, firstDevice?.id, targetDeviceId]);

  useEffect(() => {
    if (!open) return;
    if (scenario) {
      setTitle(scenario.title);
      setMetric(scenario.metric);
      setOperator(scenario.operator);
      setValue(String(scenario.value));
      setUnit(scenario.unit ?? "none");
      setTargetDeviceId(scenario.targetDeviceId ?? "");
      setCommand(scenario.command);
      setActive(scenario.active);
      return;
    }

    setTitle("");
    setMetric("Температура");
    setOperator(">");
    setValue("25");
    setUnit("°C");
    setTargetDeviceId("");
    setCommand("Включить");
    setActive(true);
  }, [open, scenario]);

  const mutation = useMutation({
    mutationFn: (input: {
      title: string;
      metric: ScenarioMetric;
      operator: ScenarioOperator;
      value: number;
      unit: string | null;
      targetDeviceId: string | null;
      targetDeviceName: string;
      command: ScenarioCommand;
      active: boolean;
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
      metric,
      operator,
      value: Number(value),
      unit: unit === "none" ? null : unit,
      targetDeviceId: (selectedDevice?.id ?? targetDeviceId) || null,
      targetDeviceName: selectedDevice?.name ?? scenario?.targetDeviceName ?? "Устройство",
      command,
      active
    });
  }

  return (
    <Modal open={open} onClose={onClose} title={editing ? "Редактировать сценарий" : "Добавить сценарий"} description="Создай автоматизацию по принципу “если → то”">
      <div className="grid gap-4">
        <div>
          <label className="mb-2 block text-sm text-zinc-400">Название сценария</label>
          <Input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Например: Жарко дома" />
        </div>

        <div className="grid gap-4 md:grid-cols-[1.2fr,0.7fr,0.8fr,0.8fr]">
          <Field label="Если">
            <Select value={metric} onChange={(event) => setMetric(event.target.value as ScenarioMetric)}>
              {["Температура", "Влажность", "Движение", "Освещенность", "CO2", "Выключатель"].map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </Select>
          </Field>
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
          <Field label="Ед.">
            <Select value={unit} onChange={(event) => setUnit(event.target.value)}>
              <option value="°C">°C</option>
              <option value="%">%</option>
              <option value="none">Без единицы</option>
            </Select>
          </Field>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Устройство">
            <Select value={targetDeviceId || (firstDevice?.id ?? "")} onChange={(event) => setTargetDeviceId(event.target.value)}>
              {devices.map((device) => (
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
              <option value="Установить значение">Установить значение</option>
            </Select>
          </Field>
        </div>

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
          <Button disabled={mutation.isPending || !title.trim()} onClick={submit}>
            {editing ? "Сохранить изменения" : "Сохранить сценарий"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-2 block text-sm text-zinc-400">{label}</label>
      {children}
    </div>
  );
}
