import { Activity, Bell, Lightbulb, Settings, Thermometer } from "lucide-react";
import type { NotificationItem } from "@/shared/api/types";

const iconByType = {
  temperature: Thermometer,
  motion: Activity,
  system: Settings,
  device: Lightbulb,
  scenario: Bell
};

export function NotificationRow({ item, onClick }: { item: NotificationItem; onClick?: () => void }) {
  const Icon = iconByType[item.type] ?? Bell;
  const time = new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(item.createdAt));

  return (
    <button onClick={onClick} className="flex w-full items-center gap-4 rounded-2xl border border-white/10 bg-black/20 p-4 text-left transition hover:bg-white/5">
      <div className="rounded-2xl bg-violet-500/10 p-3">
        <Icon className="h-5 w-5 text-violet-300" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-white">{item.title}</p>
        <p className="mt-1 text-sm text-zinc-500">{time}</p>
      </div>
      {item.unread ? <div className="h-2.5 w-2.5 rounded-full bg-red-400" /> : null}
    </button>
  );
}
