import type { Device } from "@/shared/api/types";
import { Badge } from "@/shared/ui/Badge";
import { Button } from "@/shared/ui/Button";
import { Card, CardContent } from "@/shared/ui/Card";
import { Switch } from "@/shared/ui/Switch";
import { getDeviceIcon } from "./deviceIcon";

export function DeviceCard({ device, pending, onToggle }: { device: Device; pending?: boolean; onToggle: (checked: boolean) => void }) {
  const Icon = getDeviceIcon(device.type, device.category);
  const state = getDeviceState(device);

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
              {device.metric ? <p className="mt-2 text-sm text-emerald-400">{device.metric}</p> : null}
            </div>
          </div>
          <Switch checked={device.enabled} disabled={pending} onCheckedChange={onToggle} />
        </div>
        <div className="mt-auto flex flex-wrap items-center justify-between gap-3 pt-5">
          <Badge className={state.className}>{state.label}</Badge>
          <Button variant="soft" className="min-w-[112px] rounded-xl">
            Подробнее
          </Button>
        </div>
      </CardContent>
    </Card>
  );
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
