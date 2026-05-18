import { Moon, Play, SunMedium, Zap } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/shared/api/http";
import { queryKeys } from "@/shared/api/queryKeys";
import type { Scenario } from "@/shared/api/types";
import { Button } from "@/shared/ui/Button";

export function QuickActions({ scenarios }: { scenarios: Scenario[] }) {
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: api.runScenario,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.devices }),
        queryClient.invalidateQueries({ queryKey: queryKeys.dashboard }),
        queryClient.invalidateQueries({ queryKey: queryKeys.notifications }),
        queryClient.invalidateQueries({ queryKey: queryKeys.scenarios })
      ]);
    }
  });

  if (scenarios.length === 0) {
    return null;
  }

  return (
    <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {scenarios.map((scenario, index) => {
        const Icon = getScenarioIcon(scenario.title);
        return (
          <Button
            key={scenario.id}
            className="h-14 justify-start"
            variant={index === 0 ? "primary" : "soft"}
            disabled={mutation.isPending}
            onClick={() => mutation.mutate(scenario.id)}
          >
            <Icon className="h-4 w-4 shrink-0" />
            <span className="whitespace-normal text-left text-sm leading-5">{scenario.title}</span>
          </Button>
        );
      })}
    </section>
  );
}

function getScenarioIcon(title: string) {
  if (title.includes("Ночной")) {
    return Moon;
  }
  if (title.includes("Утренний")) {
    return SunMedium;
  }
  if (title.includes("свет")) {
    return Zap;
  }
  return Play;
}
