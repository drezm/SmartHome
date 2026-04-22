import { Pencil, Trash2 } from "lucide-react";
import type { Scenario } from "@/shared/api/types";
import { Button } from "@/shared/ui/Button";
import { Card, CardContent } from "@/shared/ui/Card";
import { Switch } from "@/shared/ui/Switch";

export function ScenarioCard({
  scenario,
  pending,
  onToggle,
  onEdit,
  onDelete
}: {
  scenario: Scenario;
  pending?: boolean;
  onToggle: (checked: boolean) => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <Card className="rounded-3xl">
      <CardContent>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 space-y-3">
            <h3 className="break-words text-lg font-medium text-white">{scenario.title}</h3>
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">Если</p>
              <p className="break-words text-base text-white">{scenario.condition}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">То</p>
              <p className="break-words text-base text-white">{scenario.action}</p>
            </div>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-3">
            <Switch checked={scenario.active} disabled={pending} onCheckedChange={onToggle} />
            <div className="flex gap-2">
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
