export type DeviceType = "MOTION_SENSOR" | "TEMPERATURE_SENSOR" | "LIGHT_SENSOR" | "CLIMATE_SENSOR" | "SWITCH_SENSOR";
export type DeviceCategory = "Освещение" | "Климат" | "Розетки" | "Безопасность" | "Датчики" | "Другое";
export type ScenarioMetric = "Температура" | "Влажность" | "Движение" | "Освещенность" | "CO2" | "Выключатель";
export type ScenarioOperator = ">" | "<" | "=";
export type ScenarioCommand = "Включить" | "Выключить" | "Инвертировать" | "Установить значение";
export type QuickActionKind = "TURN_ON_LIGHTS" | "TURN_OFF_ALL" | "NIGHT_MODE" | "MORNING_MODE";

export interface User {
  id: string;
  name: string;
  email: string;
  createdAt: string;
}

export interface AuthSession {
  user: User;
  token: string;
}

export interface Device {
  id: string;
  name: string;
  type: DeviceType;
  category: DeviceCategory;
  room: string;
  online: boolean;
  enabled: boolean;
  metric: string | null;
  lastSeen: string;
  createdAt: string;
}

export interface Scenario {
  id: string;
  title: string;
  metric: ScenarioMetric;
  operator: ScenarioOperator;
  value: number;
  unit: string | null;
  targetDeviceId: string | null;
  targetDeviceName: string;
  command: ScenarioCommand;
  active: boolean;
  condition: string;
  action: string;
  createdAt: string;
}

export interface NotificationItem {
  id: string;
  title: string;
  type: "temperature" | "motion" | "system" | "device" | "scenario";
  unread: boolean;
  createdAt: string;
}

export interface TelemetryPoint {
  id: string;
  deviceId: string;
  kind: string;
  value: number;
  unit: string | null;
  createdAt: string;
}

export interface Subscription {
  plan: "free" | "premium";
  status: "free" | "active" | "expired" | "cancelled";
  startedAt: string | null;
  expiresAt: string | null;
  cancelledAt: string | null;
  paymentMockLast4: string | null;
  paymentEmail: string | null;
  isPremium: boolean;
  daysLeft: number | null;
}

export interface TelegramIntegration {
  connected: boolean;
  chatId: string | null;
  hasBotToken: boolean;
  updatedAt: string | null;
}

export interface ReportSummary {
  range: "7d" | "30d";
  generatedAt: string;
  temperatureSeries: Array<{ time: string; value: number }>;
  humiditySeries: Array<{ time: string; value: number }>;
  deviceActivity: Array<{ name: string; enabled: boolean; online: boolean; events: number }>;
  scenarioActivity: Array<{ title: string; active: boolean }>;
  notificationStats: Array<{ type: string; count: number }>;
  summary: string;
}

export interface NewsItem {
  id: string;
  title: string;
  source: string;
  url: string;
  publishedAt: string | null;
}

export interface DashboardSummary {
  stats: {
    temperature: number | null;
    onlineDevices: number;
    totalDevices: number;
    activeScenarios: number;
    eventsToday: number;
    unreadNotifications: number;
  };
  temperatureSeries: Array<{ time: string; value: number }>;
  activitySeries: Array<{ day: string; events: number }>;
  currentScenario: Scenario | null;
  subscription: Subscription;
  backendStatus: {
    collectorUrl: string;
    mode: "connected" | "degraded" | "local";
    lastSyncError: string | null;
  };
}
