import { Pencil, Play, Star, Trash2 } from "lucide-react";
import type { Scenario } from "@/shared/api/types";
import { Button } from "@/shared/ui/Button";
import { Card, CardContent } from "@/shared/ui/Card";
import { Switch } from "@/shared/ui/Switch";

export function ScenarioCard({
  scenario,
  pending,
  onToggle,
  onEdit,
  onDelete,
  onRun
}: {
  scenario: Scenario;
  pending?: boolean;
  onToggle: (checked: boolean) => void;
  onEdit: () => void;
  onDelete: () => void;
  onRun?: () => void;
}) {
  return (
    <Card className="rounded-3xl">
      <CardContent>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="break-words text-lg font-medium text-white">{scenario.title}</h3>
              {scenario.favorite ? (
                <span className="inline-flex items-center gap-1 rounded-full border border-amber-400/20 bg-amber-500/15 px-2 py-1 text-xs text-amber-200">
                  <Star className="h-3 w-3" /> Избранное
                </span>
              ) : null}
            </div>

            {scenario.triggerType === "automatic" ? (
              <>
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                    <p className="text-sm text-zinc-400">Если</p>
                    <p className="mt-1 break-words text-base font-medium text-white">{scenario.condition}</p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                    <p className="text-sm text-zinc-400">То</p>
                    <p className="mt-1 break-words text-base font-medium text-white">{scenario.action}</p>
                  </div>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                  <p className="text-sm text-zinc-400">Последний результат</p>
                  <p className="mt-1 text-sm text-zinc-200">{scenario.lastEvaluation.reason ?? "Сценарий еще не проверялся."}</p>
                </div>
              </>
            ) : (
              <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                <p className="text-sm text-zinc-400">Ручной режим</p>
                <p className="mt-1 text-base font-medium text-white">{scenario.action}</p>
                <p className="mt-2 text-sm text-zinc-400">{formatManualActions(scenario)}</p>
              </div>
            )}
          </div>
          <div className="flex shrink-0 items-center justify-between gap-3 sm:flex-col sm:items-end">
            <Switch checked={scenario.active} disabled={pending} onCheckedChange={onToggle} />
            <div className="flex gap-2">
              {scenario.triggerType === "manual" && onRun ? (
                <Button type="button" variant="soft" onClick={onRun} disabled={pending} className="h-10 px-3" title="Запустить">
                  <Play className="h-4 w-4" />
                </Button>
              ) : null}
              <Button type="button" variant="soft" onClick={onEdit} disabled={pending} className="h-10 px-3" title="Редактировать">
                <Pencil className="h-4 w-4" />
              </Button>
              <Button type="button" variant="danger" onClick={onDelete} disabled={pending} className="h-10 px-3" title="Удалить">
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function formatManualActions(scenario: Scenario) {
  if (scenario.actions.length === 0) {
    return "Действия пока не настроены.";
  }

  return scenario.actions.map((action) => `${action.command} ${action.targetDeviceName.toLowerCase()}`).join(" · ");
}
