import { Navigate, Outlet, Route, Routes } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { lazy, Suspense, useEffect } from "react";
import { api } from "@/shared/api/http";
import { queryKeys } from "@/shared/api/queryKeys";
import { useAuth } from "./providers/AuthProvider";
import { AppShell } from "@/widgets/app-shell/AppShell";

const AuthPage = lazy(() => import("@/pages/auth/AuthPage").then((module) => ({ default: module.AuthPage })));
const ForgotPasswordPage = lazy(() => import("@/pages/auth/ForgotPasswordPage").then((module) => ({ default: module.ForgotPasswordPage })));
const ResetPasswordPage = lazy(() => import("@/pages/auth/ResetPasswordPage").then((module) => ({ default: module.ResetPasswordPage })));
const DashboardPage = lazy(() => import("@/pages/dashboard/DashboardPage").then((module) => ({ default: module.DashboardPage })));
const DevicesPage = lazy(() => import("@/pages/devices/DevicesPage").then((module) => ({ default: module.DevicesPage })));
const ScenariosPage = lazy(() => import("@/pages/scenarios/ScenariosPage").then((module) => ({ default: module.ScenariosPage })));
const AnalyticsPage = lazy(() => import("@/pages/analytics/AnalyticsPage").then((module) => ({ default: module.AnalyticsPage })));
const NotificationsPage = lazy(() => import("@/pages/notifications/NotificationsPage").then((module) => ({ default: module.NotificationsPage })));
const ProfilePage = lazy(() => import("@/pages/profile/ProfilePage").then((module) => ({ default: module.ProfilePage })));
const SettingsPage = lazy(() => import("@/pages/settings/SettingsPage").then((module) => ({ default: module.SettingsPage })));
const CheckoutPage = lazy(() => import("@/pages/checkout/CheckoutPage").then((module) => ({ default: module.CheckoutPage })));

export function App() {
  return (
    <Suspense fallback={<PageFallback />}>
      <Routes>
        <Route path="/login" element={<AuthPage mode="login" />} />
        <Route path="/register" element={<AuthPage mode="register" />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route element={<RequireAuth />}>
          <Route element={<AppShell />}>
            <Route index element={<DashboardPage />} />
            <Route path="devices" element={<DevicesPage />} />
            <Route path="scenarios" element={<ScenariosPage />} />
            <Route path="analytics" element={<AnalyticsPage />} />
            <Route path="notifications" element={<NotificationsPage />} />
            <Route path="profile" element={<ProfilePage />} />
            <Route path="checkout" element={<CheckoutPage />} />
            <Route path="settings" element={<SettingsPage />} />
          </Route>
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
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

function PageFallback() {
  return <div className="flex min-h-screen items-center justify-center bg-[#09090B] text-zinc-300">Загрузка...</div>;
}
