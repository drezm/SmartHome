import { Lightbulb, Moon, Power, SunMedium } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/shared/api/http";
import { queryKeys } from "@/shared/api/queryKeys";
import type { QuickActionKind } from "@/shared/api/types";
import { Button } from "@/shared/ui/Button";

const actions: Array<{ id: QuickActionKind; title: string; icon: typeof Lightbulb; primary?: boolean }> = [
  { id: "TURN_ON_LIGHTS", title: "Включить свет в доме", icon: Lightbulb, primary: true },
  { id: "TURN_OFF_ALL", title: "Выключить все устройства", icon: Power },
  { id: "NIGHT_MODE", title: "Ночной режим", icon: Moon },
  { id: "MORNING_MODE", title: "Утренний режим", icon: SunMedium }
];

export function QuickActions() {
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: api.quickAction,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.devices }),
        queryClient.invalidateQueries({ queryKey: queryKeys.dashboard }),
        queryClient.invalidateQueries({ queryKey: queryKeys.notifications })
      ]);
    }
  });

  return (
    <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {actions.map((action) => {
        const Icon = action.icon;
        return (
          <Button
            key={action.id}
            className="h-14 justify-start"
            variant={action.primary ? "primary" : "soft"}
            disabled={mutation.isPending}
            onClick={() => mutation.mutate(action.id)}
          >
            <Icon className="h-4 w-4 shrink-0" />
            <span className="whitespace-normal text-left text-sm leading-5">{action.title}</span>
          </Button>
        );
      })}
    </section>
  );
}
