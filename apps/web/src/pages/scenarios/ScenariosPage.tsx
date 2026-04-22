import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Plus } from "lucide-react";
import { useState } from "react";
import { ScenarioCard } from "@/entities/scenario/ScenarioCard";
import { CreateScenarioModal } from "@/features/scenarios/CreateScenarioModal";
import { api } from "@/shared/api/http";
import { queryKeys } from "@/shared/api/queryKeys";
import type { Scenario } from "@/shared/api/types";
import { Button } from "@/shared/ui/Button";
import { Modal } from "@/shared/ui/Modal";
import { SectionTitle } from "@/widgets/dashboard/SectionTitle";

export function ScenariosPage() {
  const [modalOpen, setModalOpen] = useState(false);
  const [editingScenario, setEditingScenario] = useState<Scenario | null>(null);
  const [scenarioToDelete, setScenarioToDelete] = useState<Scenario | null>(null);
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
  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.deleteScenario(id),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.scenarios }),
        queryClient.invalidateQueries({ queryKey: queryKeys.dashboard }),
        queryClient.invalidateQueries({ queryKey: queryKeys.notifications })
      ]);
      setScenarioToDelete(null);
    }
  });
  const formOpen = modalOpen || Boolean(editingScenario);

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
          <ScenarioCard
            key={scenario.id}
            scenario={scenario}
            pending={mutation.isPending || deleteMutation.isPending}
            onToggle={(active) => mutation.mutate({ id: scenario.id, active })}
            onEdit={() => setEditingScenario(scenario)}
            onDelete={() => setScenarioToDelete(scenario)}
          />
        ))}
      </div>
      <CreateScenarioModal
        open={formOpen}
        scenario={editingScenario}
        onClose={() => {
          setModalOpen(false);
          setEditingScenario(null);
        }}
      />
      <Modal open={Boolean(scenarioToDelete)} onClose={() => setScenarioToDelete(null)} title="Удалить сценарий" description="Сценарий будет удален без возможности восстановления." maxWidth="max-w-md">
        <div className="space-y-4">
          <p className="text-sm text-zinc-300">Удалить сценарий “{scenarioToDelete?.title}”?</p>
          {deleteMutation.error ? <p className="rounded-2xl border border-red-400/20 bg-red-500/10 p-3 text-sm text-red-200">{deleteMutation.error.message}</p> : null}
          <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
            <Button variant="soft" onClick={() => setScenarioToDelete(null)}>
              Отмена
            </Button>
            <Button variant="danger" disabled={deleteMutation.isPending || !scenarioToDelete} onClick={() => scenarioToDelete && deleteMutation.mutate(scenarioToDelete.id)}>
              Удалить
            </Button>
          </div>
        </div>
      </Modal>
    </motion.div>
  );
}
