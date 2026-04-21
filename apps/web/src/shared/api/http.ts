import type {
  AuthSession,
  DashboardSummary,
  Device,
  DeviceCategory,
  DeviceType,
  NotificationItem,
  QuickActionKind,
  Scenario,
  ScenarioCommand,
  ScenarioMetric,
  ScenarioOperator,
  TelemetryPoint,
  User
} from "./types";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3000/api";
const TOKEN_KEY = "smart-flow-token";

export function getStoredToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function setStoredToken(token: string | null) {
  if (token) {
    localStorage.setItem(TOKEN_KEY, token);
  } else {
    localStorage.removeItem(TOKEN_KEY);
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getStoredToken();
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers
    }
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => ({ message: "Ошибка запроса" }));
    throw new Error(payload.message ?? "Ошибка запроса");
  }

  return response.json() as Promise<T>;
}

export const api = {
  register: (input: { name: string; email: string; password: string }) =>
    request<AuthSession>("/auth/register", {
      method: "POST",
      body: JSON.stringify(input)
    }),
  login: (input: { email: string; password: string }) =>
    request<AuthSession>("/auth/login", {
      method: "POST",
      body: JSON.stringify(input)
    }),
  me: () => request<{ user: User }>("/auth/me"),
  dashboard: () => request<DashboardSummary>("/dashboard"),
  devices: () => request<{ devices: Device[] }>("/devices"),
  createDevice: (input: { name: string; type: DeviceType; category: DeviceCategory; room: string; enabled?: boolean }) =>
    request<{ device: Device }>("/devices", {
      method: "POST",
      body: JSON.stringify(input)
    }),
  updateDevice: (id: string, input: Partial<Pick<Device, "name" | "category" | "room" | "online" | "enabled" | "metric">>) =>
    request<{ device: Device }>(`/devices/${id}`, {
      method: "PATCH",
      body: JSON.stringify(input)
    }),
  scenarios: () => request<{ scenarios: Scenario[] }>("/scenarios"),
  createScenario: (input: {
    title: string;
    metric: ScenarioMetric;
    operator: ScenarioOperator;
    value: number;
    unit: string | null;
    targetDeviceId: string | null;
    targetDeviceName: string;
    command: ScenarioCommand;
  }) =>
    request<{ scenario: Scenario }>("/scenarios", {
      method: "POST",
      body: JSON.stringify(input)
    }),
  updateScenario: (id: string, input: { title?: string; active?: boolean }) =>
    request<{ scenario: Scenario }>(`/scenarios/${id}`, {
      method: "PATCH",
      body: JSON.stringify(input)
    }),
  telemetry: () => request<{ telemetry: TelemetryPoint[] }>("/telemetry"),
  addTelemetry: (deviceId: string, input: { kind: string; value: number; unit: string | null }) =>
    request<{ telemetry: TelemetryPoint }>(`/devices/${deviceId}/telemetry`, {
      method: "POST",
      body: JSON.stringify(input)
    }),
  notifications: () => request<{ notifications: NotificationItem[] }>("/notifications"),
  markNotificationRead: (id: string) =>
    request<{ notification: NotificationItem }>(`/notifications/${id}/read`, {
      method: "PATCH"
    }),
  quickAction: (action: QuickActionKind) =>
    request<{ devices: Device[] }>("/quick-actions", {
      method: "POST",
      body: JSON.stringify({ action })
    })
};
