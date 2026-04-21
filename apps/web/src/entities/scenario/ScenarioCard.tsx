import type { Scenario } from "@/shared/api/types";
import { Card, CardContent } from "@/shared/ui/Card";
import { Switch } from "@/shared/ui/Switch";

export function ScenarioCard({ scenario, pending, onToggle }: { scenario: Scenario; pending?: boolean; onToggle: (checked: boolean) => void }) {
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
          <Switch checked={scenario.active} disabled={pending} onCheckedChange={onToggle} />
        </div>
      </CardContent>
    </Card>
  );
}
