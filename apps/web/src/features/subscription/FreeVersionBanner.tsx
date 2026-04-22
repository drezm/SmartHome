import { Crown } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/shared/ui/Button";

export function FreeVersionBanner() {
  const navigate = useNavigate();

  return (
    <div className="rounded-3xl border border-violet-400/20 bg-violet-500/10 p-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="rounded-2xl bg-violet-500/20 p-3">
            <Crown className="h-5 w-5 text-violet-300" />
          </div>
          <div>
            <p className="font-medium text-white">Используется бесплатная версия</p>
            <p className="mt-1 text-sm text-zinc-400">Premium открывает Telegram-уведомления, расширенную аналитику и PDF-отчеты за 150 ₽/месяц.</p>
          </div>
        </div>
        <Button onClick={() => navigate("/checkout")} className="w-full sm:w-auto">
          Оформить подписку
        </Button>
      </div>
    </div>
  );
}
