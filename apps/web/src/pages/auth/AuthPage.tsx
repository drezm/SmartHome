import { Activity, Bell, Home, Smartphone } from "lucide-react";
import { Navigate } from "react-router-dom";
import { motion } from "framer-motion";
import { useAuth } from "@/app/providers/AuthProvider";
import { AuthForm } from "@/features/auth/AuthForm";
import { Badge } from "@/shared/ui/Badge";
import { StatCard } from "@/widgets/dashboard/StatCard";

export function AuthPage({ mode }: { mode: "login" | "register" }) {
  const auth = useAuth();

  if (auth.token) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="min-h-screen bg-[#09090B] text-white">
      <div className="mx-auto grid min-h-screen max-w-7xl lg:grid-cols-2">
        <div className="hidden border-r border-white/10 lg:flex lg:flex-col lg:justify-between lg:p-10">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-violet-500/20 p-3 ring-1 ring-violet-400/30">
              <Home className="h-6 w-6 text-violet-300" />
            </div>
            <div>
              <div className="text-lg font-semibold text-white">Smart Flow Home</div>
              <div className="text-sm text-zinc-400">Управление умным домом</div>
            </div>
          </div>

          <div className="space-y-6">
            <Badge className="border-violet-400/20 bg-violet-500/15 px-4 py-1 text-violet-200">Minimal smart home UI</Badge>
            <h1 className="max-w-xl text-5xl font-semibold leading-tight text-white">Контролируй устройства, сценарии и телеметрию в одном интерфейсе.</h1>
            <p className="max-w-lg text-base text-zinc-400">Адаптивная панель управления с авторизацией, аналитикой, устройствами и сценариями автоматизации.</p>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <StatCard title="Устройств" value="12" subtitle="8 активны" icon={Smartphone} />
            <StatCard title="Сценариев" value="5" subtitle="3 включены" icon={Activity} />
            <StatCard title="Событий" value="148" subtitle="за сегодня" icon={Bell} />
          </div>
        </div>

        <div className="flex items-center justify-center p-6 sm:p-10">
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }} className="w-full max-w-md">
            <AuthForm mode={mode} />
          </motion.div>
        </div>
      </div>
    </div>
  );
}
