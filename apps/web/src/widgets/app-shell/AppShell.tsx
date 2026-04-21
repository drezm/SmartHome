import { NavLink, Outlet, useNavigate } from "react-router-dom";
import {
  Activity,
  BarChart3,
  Bell,
  ChevronRight,
  Home,
  LogOut,
  Moon,
  Settings,
  Smartphone,
  SunMedium,
  User,
  Wifi
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/shared/api/http";
import { queryKeys } from "@/shared/api/queryKeys";
import { Avatar, AvatarFallback } from "@/shared/ui/Avatar";
import { Badge } from "@/shared/ui/Badge";
import { Button } from "@/shared/ui/Button";
import { Progress } from "@/shared/ui/Progress";
import { useAuth } from "@/app/providers/AuthProvider";
import { useTheme } from "@/app/providers/ThemeProvider";
import { cn } from "@/shared/lib/cn";
import { getBackendStatusView } from "@/shared/lib/backendStatus";

const nav = [
  { to: "/", label: "Дашборд", icon: Home },
  { to: "/devices", label: "Устройства", icon: Smartphone },
  { to: "/scenarios", label: "Сценарии", icon: Activity },
  { to: "/analytics", label: "Аналитика", icon: BarChart3 },
  { to: "/notifications", label: "Уведомления", icon: Bell },
  { to: "/profile", label: "Профиль", icon: User },
  { to: "/settings", label: "Настройки", icon: Settings }
];

export function AppShell() {
  const auth = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const dashboard = useQuery({ queryKey: queryKeys.dashboard, queryFn: api.dashboard });
  const stats = dashboard.data?.stats;
  const backendStatus = getBackendStatusView(dashboard.data?.backendStatus);
  const [firstName = "M", secondName = "S"] = (auth.user?.name ?? "Матвей Саблуков").split(" ");
  const initials = `${firstName[0] ?? "M"}${secondName[0] ?? "S"}`.toUpperCase();

  return (
    <div className="min-h-screen bg-[#09090B] text-white">
      <div className="mx-auto flex min-h-screen max-w-[1600px]">
        <aside className="hidden w-72 shrink-0 border-r border-white/10 bg-[#0D0E13] p-4 xl:block xl:p-6">
          <div className="flex items-center gap-3 px-2 py-3">
            <div className="rounded-2xl bg-violet-500/20 p-3 ring-1 ring-violet-400/30">
              <Home className="h-6 w-6 text-violet-300" />
            </div>
            <div>
              <p className="font-semibold text-white">Smart Flow Home</p>
              <p className="text-sm text-zinc-400">Панель управления</p>
            </div>
          </div>

          <nav className="mt-8 space-y-2">
            {nav.map(({ to, label, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                end={to === "/"}
                className={({ isActive }) =>
                  cn(
                    "flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left transition",
                    isActive ? "bg-violet-600 text-white" : "bg-transparent text-zinc-300 hover:bg-white/5 hover:text-white"
                  )
                }
              >
                <Icon className="h-5 w-5" />
                <span>{label}</span>
                {to === "/notifications" && stats?.unreadNotifications ? (
                  <span className="ml-auto rounded-full bg-violet-500 px-2 py-0.5 text-xs text-white">{stats.unreadNotifications}</span>
                ) : null}
              </NavLink>
            ))}
          </nav>

          <div className="mt-8 rounded-3xl border border-white/10 bg-gradient-to-br from-violet-500/15 to-transparent p-4">
            <p className="text-sm text-zinc-400">Дом</p>
            <div className="mt-2 flex items-center justify-between">
              <p className="font-medium text-white">Статус сети</p>
              <Badge className={backendStatus.badgeClassName}>{backendStatus.label}</Badge>
            </div>
            <div className="mt-4 space-y-3 text-sm text-zinc-400">
              <div className="flex items-center justify-between">
                <span>Устройства на связи</span>
                <span className="text-white">{stats?.onlineDevices ?? 0}/{stats?.totalDevices ?? 0}</span>
              </div>
              <Progress value={stats?.totalDevices ? (stats.onlineDevices / stats.totalDevices) * 100 : 0} />
            </div>
          </div>

          <button onClick={() => navigate("/profile")} className="mt-8 flex w-full items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-4 text-left transition hover:bg-white/10">
            <Avatar className="h-11 w-11 ring-1 ring-white/10">
              <AvatarFallback className="bg-violet-500/20 text-violet-200">{initials}</AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium text-white">{auth.user?.name ?? "Профиль"}</p>
              <p className="text-sm text-zinc-400">Профиль</p>
            </div>
            <ChevronRight className="h-4 w-4 text-zinc-500" />
          </button>
        </aside>

        <main className="min-w-0 flex-1 p-4 sm:p-6 lg:p-8">
          <header className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="min-w-0">
              <h1 className="text-2xl font-semibold text-white sm:text-3xl">Умный дом</h1>
              <p className="mt-1 text-sm text-zinc-400">Управление устройствами, сценариями и телеметрией</p>
            </div>
            <div className="flex flex-wrap items-center gap-2 sm:gap-3">
              <Button onClick={() => navigate("/notifications")} variant="soft" className="min-h-10 px-3 sm:px-4">
                <Bell className="h-4 w-4" />
                <span className="hidden sm:inline">Уведомления</span>
                {stats?.unreadNotifications ? <span className="rounded-full bg-violet-500 px-2 py-0.5 text-xs text-white">{stats.unreadNotifications}</span> : null}
              </Button>
              <Button
                type="button"
                variant="soft"
                className="min-h-10 px-3"
                aria-label={theme === "dark" ? "Включить светлую тему" : "Включить темную тему"}
                onClick={toggleTheme}
              >
                {theme === "dark" ? <SunMedium className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              </Button>
              <Button
                variant="ghost"
                onClick={() => {
                  auth.logout();
                  navigate("/login");
                }}
                className="min-h-10 px-3 sm:px-4"
              >
                <LogOut className="h-4 w-4" />
                <span className="hidden sm:inline">Выйти</span>
              </Button>
              <Avatar className="h-10 w-10 ring-1 ring-white/10 max-sm:hidden">
                <AvatarFallback className="bg-violet-500/20 text-violet-200">{initials}</AvatarFallback>
              </Avatar>
            </div>
          </header>

          <div className="-mx-4 mb-6 flex gap-2 overflow-x-auto px-4 pb-2 sm:-mx-6 sm:px-6 xl:hidden">
            {nav.map(({ to, label, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                end={to === "/"}
                className={({ isActive }) =>
                  cn(
                    "inline-flex min-h-10 shrink-0 items-center gap-2 rounded-2xl border px-3 py-2 text-sm transition",
                    isActive ? "border-violet-400/40 bg-violet-500/15 text-white" : "border-white/10 bg-white/5 text-zinc-300 hover:bg-white/10 hover:text-white"
                  )
                }
              >
                <Icon className="h-4 w-4" />
                <span>{label}</span>
              </NavLink>
            ))}
          </div>

          <Outlet />
        </main>
      </div>
    </div>
  );
}
