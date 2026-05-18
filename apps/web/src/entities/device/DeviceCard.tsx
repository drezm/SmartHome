import { Pencil, Trash2 } from "lucide-react";
import type { Device } from "@/shared/api/types";
import { Badge } from "@/shared/ui/Badge";
import { Button } from "@/shared/ui/Button";
import { Card, CardContent } from "@/shared/ui/Card";
import { Switch } from "@/shared/ui/Switch";
import { getDeviceIcon } from "./deviceIcon";

export function DeviceCard({
  device,
  pending,
  readonly = false,
  onToggle,
  onEdit,
  onDelete
}: {
  device: Device;
  pending?: boolean;
  readonly?: boolean;
  onToggle?: (checked: boolean) => void;
  onEdit?: () => void;
  onDelete?: () => void;
}) {
  const Icon = getDeviceIcon(device.type, device.category);
  const state = getDeviceState(device);
  const kind = getDeviceKind(device);

  return (
    <Card className="flex min-h-[174px] rounded-3xl">
      <CardContent className="flex flex-1 flex-col">
        <div className="flex items-start justify-between gap-4">
          <div className="flex min-w-0 items-start gap-3 sm:gap-4">
            <div className="shrink-0 rounded-2xl bg-violet-500/15 p-3">
              <Icon className="h-5 w-5 text-violet-300" />
            </div>
            <div className="min-w-0">
              <h3 className="break-words font-medium text-white">{device.name}</h3>
              <p className="text-sm text-zinc-400">{device.category} • {device.room}</p>
              {device.sourceKind !== "manual" && device.metric ? <p className="mt-2 text-sm text-emerald-400">{device.metric}</p> : null}
            </div>
          </div>
          {readonly ? null : <Switch checked={device.enabled} disabled={pending} onCheckedChange={onToggle} />}
        </div>
        <div className="mt-auto flex flex-wrap items-center justify-between gap-3 pt-5">
          <div className="flex flex-wrap gap-2">
            <Badge className={state.className}>{state.label}</Badge>
            <Badge className={kind.className}>{kind.label}</Badge>
          </div>
          {readonly ? (
            <Badge className="border-sky-400/20 bg-sky-500/15 text-sky-200">Системное</Badge>
          ) : (
            <div className="flex gap-2">
              <Button type="button" variant="soft" onClick={onEdit} disabled={pending} className="h-10 px-3" title="Редактировать">
                <Pencil className="h-4 w-4" />
              </Button>
              <Button type="button" variant="danger" onClick={onDelete} disabled={pending} className="h-10 px-3" title="Удалить">
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function getDeviceKind(device: Device) {
  if (device.sourceKind === "open_meteo") {
    return {
      label: "Уличный датчик",
      className: "border-sky-400/20 bg-sky-500/15 text-sky-200"
    };
  }

  if (device.sourceKind === "home_sensor") {
    return {
      label: "Домашний датчик",
      className: "border-amber-400/20 bg-amber-500/15 text-amber-200"
    };
  }

  return {
    label: "Устройство",
    className: "border-violet-400/20 bg-violet-500/15 text-violet-200"
  };
}

function getDeviceState(device: Device) {
  if (!device.online) {
    return {
      label: "Нет связи",
      className: "border-red-400/20 bg-red-500/15 text-red-300"
    };
  }

  if (!device.enabled) {
    return {
      label: "Выключено",
      className: "border-zinc-400/20 bg-zinc-500/15 text-zinc-300"
    };
  }

  return {
    label: "Включено",
    className: "border-emerald-400/20 bg-emerald-500/15 text-emerald-300"
  };
}
