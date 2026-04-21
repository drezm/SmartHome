import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Plus } from "lucide-react";
import { useState } from "react";
import { ScenarioCard } from "@/entities/scenario/ScenarioCard";
import { CreateScenarioModal } from "@/features/scenarios/CreateScenarioModal";
import { api } from "@/shared/api/http";
import { queryKeys } from "@/shared/api/queryKeys";
import { Button } from "@/shared/ui/Button";
import { SectionTitle } from "@/widgets/dashboard/SectionTitle";

export function ScenariosPage() {
  const [modalOpen, setModalOpen] = useState(false);
  const queryClient = useQueryClient();
  const scenariosQuery = useQuery({ queryKey: queryKeys.scenarios, queryFn: api.scenarios });
  const mutation = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) => api.updateScenario(id, { active }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.scenarios }),
        queryClient.invalidateQueries({ queryKey: queryKeys.dashboard })
      ]);
    }
  });

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <SectionTitle title="Сценарии автоматизации" description="Настрой правила умного дома по принципу “если → то”" />
        <Button onClick={() => setModalOpen(true)} className="w-full sm:w-auto">
          <Plus className="h-4 w-4" /> Новый сценарий
        </Button>
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        {(scenariosQuery.data?.scenarios ?? []).map((scenario) => (
          <ScenarioCard key={scenario.id} scenario={scenario} pending={mutation.isPending} onToggle={(active) => mutation.mutate({ id: scenario.id, active })} />
        ))}
      </div>
      <CreateScenarioModal open={modalOpen} onClose={() => setModalOpen(false)} />
    </motion.div>
  );
}
