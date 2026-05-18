import type {
  AuthSession,
  ClimateSeriesPayload,
  DateRangeInput,
  DashboardSummary,
  Device,
  DeviceCategory,
  DeviceSourceKind,
  DeviceSourceMetric,
  DeviceType,
  HomeLocation,
  NewsItem,
  NotificationItem,
  ReportCatalogItem,
  ReportKind,
  ReportParameters,
  ReportPayload,
  Scenario,
  ScenarioAction,
  ScenarioCommand,
  ScenarioMetric,
  ScenarioOperator,
  ScenarioTriggerType,
  Subscription,
  TelemetryPoint,
  TelegramIntegration,
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

async function requestBlob(path: string): Promise<Blob> {
  const token = getStoredToken();
  const response = await fetch(`${API_URL}${path}`, {
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    }
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => ({ message: "Ошибка запроса" }));
    throw new Error(payload.message ?? "Ошибка запроса");
  }

  return response.blob();
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
  forgotPassword: (input: { email: string }) =>
    request<{ sent: boolean; devCode?: string }>("/auth/forgot-password", {
      method: "POST",
      body: JSON.stringify(input)
    }),
  resetPassword: (input: { email: string; code: string; password: string }) =>
    request<{ changed: boolean }>("/auth/reset-password", {
      method: "POST",
      body: JSON.stringify(input)
    }),
  verifyResetCode: (input: { email: string; code: string }) =>
    request<{ valid: boolean }>("/auth/verify-reset-code", {
      method: "POST",
      body: JSON.stringify(input)
    }),
  dashboard: () => request<DashboardSummary>("/dashboard"),
  climate: (range: DateRangeInput) => request<ClimateSeriesPayload>(`/dashboard/climate?${buildDateRangeQuery(range)}`),
  location: () => request<{ location: HomeLocation | null }>("/location"),
  saveBrowserLocation: (input: {
    latitude: number;
    longitude: number;
    accuracyMeters: number | null;
    timezone?: string;
    label?: string | null;
  }) =>
    request<{ location: HomeLocation }>("/location/browser", {
      method: "PUT",
      body: JSON.stringify({ ...input, source: "browser" })
    }),
  subscription: () => request<{ subscription: Subscription }>("/subscription"),
  checkoutSubscription: (input: { cardholderName: string; cardNumber: string; expires: string; cvc: string; paymentEmail: string }) =>
    request<{ subscription: Subscription }>("/subscription/checkout", {
      method: "POST",
      body: JSON.stringify(input)
    }),
  cancelSubscription: () =>
    request<{ subscription: Subscription }>("/subscription/cancel", {
      method: "POST"
    }),
  telegram: () => request<{ telegram: TelegramIntegration }>("/integrations/telegram"),
  saveTelegram: (input: { botToken: string; chatId: string }) =>
    request<{ telegram: TelegramIntegration }>("/integrations/telegram", {
      method: "PUT",
      body: JSON.stringify(input)
    }),
  testTelegram: () =>
    request<{ sent: boolean }>("/integrations/telegram/test", {
      method: "POST"
    }),
  deleteTelegram: () =>
    request<{ telegram: TelegramIntegration }>("/integrations/telegram", {
      method: "DELETE"
    }),
  reports: () => request<{ reports: ReportCatalogItem[] }>("/reports/catalog"),
  report: (kind: ReportKind, range: DateRangeInput, parameters: ReportParameters = {}) =>
    request<{ report: ReportPayload }>(`/reports/${kind}?${buildReportQuery(range, parameters)}`),
  reportPdf: (kind: ReportKind, range: DateRangeInput, parameters: ReportParameters = {}) =>
    requestBlob(`/reports/${kind}.pdf?${buildReportQuery(range, parameters)}`),
  news: () => request<{ news: NewsItem[] }>("/news"),
  devices: () => request<{ devices: Device[] }>("/devices"),
  createDevice: (input: {
    name: string;
    type: DeviceType;
    category: DeviceCategory;
    room: string;
    enabled?: boolean;
    sourceKind?: DeviceSourceKind;
    sourceMetric?: DeviceSourceMetric | null;
  }) =>
    request<{ device: Device }>("/devices", {
      method: "POST",
      body: JSON.stringify(input)
    }),
  updateDevice: (id: string, input: Partial<Pick<Device, "name" | "type" | "category" | "room" | "online" | "enabled" | "metric">>) =>
    request<{ device: Device }>(`/devices/${id}`, {
      method: "PATCH",
      body: JSON.stringify(input)
    }),
  deleteDevice: (id: string) =>
    request<{ device: Device }>(`/devices/${id}`, {
      method: "DELETE"
    }),
  scenarios: () => request<{ scenarios: Scenario[] }>("/scenarios"),
  createScenario: (input: {
    title: string;
    triggerType?: ScenarioTriggerType;
    automationSource?: Scenario["automationSource"];
    favorite?: boolean;
    metric: ScenarioMetric;
    operator: ScenarioOperator;
    value: number;
    unit: string | null;
    sourceDeviceId?: string | null;
    sourceDeviceName?: string | null;
    sourceMetric?: string | null;
    scheduleTime?: string | null;
    scheduleTimezone?: string | null;
    targetDeviceId: string | null;
    targetDeviceName: string;
    command: ScenarioCommand;
    active?: boolean;
    actions?: Array<Omit<ScenarioAction, "id">>;
  }) =>
    request<{ scenario: Scenario }>("/scenarios", {
      method: "POST",
      body: JSON.stringify(input)
    }),
  updateScenario: (
    id: string,
    input: Partial<
      Pick<
        Scenario,
        | "title"
        | "triggerType"
        | "automationSource"
        | "favorite"
        | "metric"
        | "operator"
        | "value"
        | "unit"
        | "sourceDeviceId"
        | "sourceDeviceName"
        | "sourceMetric"
        | "scheduleTime"
        | "scheduleTimezone"
        | "targetDeviceId"
        | "targetDeviceName"
        | "command"
        | "active"
      >
    > & { actions?: Array<Omit<ScenarioAction, "id">> }
  ) =>
    request<{ scenario: Scenario }>(`/scenarios/${id}`, {
      method: "PATCH",
      body: JSON.stringify(input)
    }),
  deleteScenario: (id: string) =>
    request<{ scenario: Scenario }>(`/scenarios/${id}`, {
      method: "DELETE"
    }),
  runScenario: (id: string) =>
    request<{ scenario: Scenario; changed: number }>(`/scenarios/${id}/run`, {
      method: "POST"
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
    })
};

function buildReportQuery(range: DateRangeInput, parameters: ReportParameters) {
  const query = new URLSearchParams(buildDateRangeQuery(range));
  Object.entries(parameters).forEach(([key, value]) => {
    if (value) {
      query.set(key, value);
    }
  });
  return query.toString();
}

function buildDateRangeQuery(range: DateRangeInput) {
  const query = new URLSearchParams({ range: range.preset });
  if (range.from && range.to) {
    query.set("from", range.from);
    query.set("to", range.to);
  }
  return query.toString();
}
