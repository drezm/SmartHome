import { Navigate, Outlet, Route, Routes } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { api } from "@/shared/api/http";
import { queryKeys } from "@/shared/api/queryKeys";
import { useAuth } from "./providers/AuthProvider";
import { AuthPage } from "@/pages/auth/AuthPage";
import { DashboardPage } from "@/pages/dashboard/DashboardPage";
import { DevicesPage } from "@/pages/devices/DevicesPage";
import { ScenariosPage } from "@/pages/scenarios/ScenariosPage";
import { AnalyticsPage } from "@/pages/analytics/AnalyticsPage";
import { NotificationsPage } from "@/pages/notifications/NotificationsPage";
import { ProfilePage } from "@/pages/profile/ProfilePage";
import { SettingsPage } from "@/pages/settings/SettingsPage";
import { AppShell } from "@/widgets/app-shell/AppShell";

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<AuthPage mode="login" />} />
      <Route path="/register" element={<AuthPage mode="register" />} />
      <Route element={<RequireAuth />}>
        <Route element={<AppShell />}>
          <Route index element={<DashboardPage />} />
          <Route path="devices" element={<DevicesPage />} />
          <Route path="scenarios" element={<ScenariosPage />} />
          <Route path="analytics" element={<AnalyticsPage />} />
          <Route path="notifications" element={<NotificationsPage />} />
          <Route path="profile" element={<ProfilePage />} />
          <Route path="settings" element={<SettingsPage />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function RequireAuth() {
  const auth = useAuth();
  const query = useQuery({
    queryKey: queryKeys.me,
    queryFn: api.me,
    enabled: Boolean(auth.token)
  });

  useEffect(() => {
    if (query.data?.user) {
      auth.setUser(query.data.user);
    }
  }, [auth, query.data?.user]);

  if (!auth.token) {
    return <Navigate to="/login" replace />;
  }

  if (query.isLoading) {
    return <div className="flex min-h-screen items-center justify-center bg-[#09090B] text-zinc-300">Загрузка...</div>;
  }

  if (query.isError) {
    auth.logout();
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}
