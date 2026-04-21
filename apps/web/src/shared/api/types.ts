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
  backendStatus: {
    collectorUrl: string;
    mode: "connected" | "degraded" | "local";
    lastSyncError: string | null;
  };
}
