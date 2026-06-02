export type DeviceType =
  | "MOTION_SENSOR"
  | "TEMPERATURE_SENSOR"
  | "LIGHT_SENSOR"
  | "CLIMATE_SENSOR"
  | "SWITCH_SENSOR";

export type DeviceCategory =
  | "Освещение"
  | "Климат"
  | "Розетки"
  | "Безопасность"
  | "Датчики"
  | "Другое";

export type ScenarioMetric =
  | "Температура"
  | "Влажность"
  | "Движение"
  | "Освещенность"
  | "Осадки"
  | "Скорость ветра"
  | "CO2"
  | "Выключатель";

export type ScenarioOperator = ">" | "<" | "=";
export type ScenarioCommand = "Включить" | "Выключить" | "Инвертировать" | "Установить значение";
export type ScenarioTriggerType = "automatic" | "manual";
export type ScenarioAutomationSource = "sensor" | "schedule";
export type TelemetrySource = "public_api" | "derived" | "manual" | "home_sensor";
export type DeviceSourceKind = "manual" | "home_sensor" | "open_meteo";
export type OpenMeteoMetric = "temperature_2m" | "relative_humidity_2m" | "precipitation" | "wind_speed_10m" | "shortwave_radiation";
export type HomeSensorMetric = "temperature" | "humidity" | "illuminance" | "motion" | "co2" | "switch";
export type DeviceSourceMetric = OpenMeteoMetric | HomeSensorMetric;
export type ReportKind =
  | "home_summary"
  | "device_activity"
  | "home_climate"
  | "scenario_activity"
  | "notifications"
  | "device_detail"
  | "sensor_detail"
  | "room_comparison"
  | "indoor_outdoor"
  | "peak_activity";
export type DateRangePreset = "24h" | "7d" | "30d";
export type ResolvedDateRangePreset = DateRangePreset | "custom";
export type ReportParameterKey = "deviceId" | "sensorId" | "roomA" | "roomB";
export type ReportParameterKind = "device" | "sensor" | "room";

export interface DateRangeInput {
  preset: DateRangePreset;
  from?: string;
  to?: string;
}

export interface DateRange {
  preset: ResolvedDateRangePreset;
  from: string;
  to: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  hubId: string;
  createdAt: string;
}

export interface UserWithPassword extends User {
  passwordHash: string;
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
  sourceKind: DeviceSourceKind;
  sourceMetric: DeviceSourceMetric | null;
  isSystem: boolean;
  lastSeen: string;
  createdAt: string;
}

export interface ScenarioAction {
  id: string;
  targetDeviceId: string | null;
  targetDeviceName: string;
  command: ScenarioCommand;
  orderIndex: number;
}

export interface ScenarioLastEvaluation {
  status: "matched" | "not_matched" | "unknown" | "unsupported";
  actualValue: number | null;
  unit: string | null;
  reason: string | null;
  evaluatedAt: string | null;
  applied: boolean;
}

export interface Scenario {
  id: string;
  title: string;
  triggerType: ScenarioTriggerType;
  automationSource: ScenarioAutomationSource;
  favorite: boolean;
  metric: ScenarioMetric;
  operator: ScenarioOperator;
  value: number;
  unit: string | null;
  sourceDeviceId: string | null;
  sourceDeviceName: string | null;
  sourceMetric: string | null;
  scheduleTime: string | null;
  scheduleTimezone: string | null;
  lastScheduleRunAt: string | null;
  targetDeviceId: string | null;
  targetDeviceName: string;
  command: ScenarioCommand;
  active: boolean;
  actions: ScenarioAction[];
  lastEvaluation: ScenarioLastEvaluation;
  condition: string;
  action: string;
  createdAt: string;
}

export interface TelemetryPoint {
  id: string;
  deviceId: string;
  kind: string;
  value: number;
  unit: string | null;
  source: TelemetrySource;
  externalObservedAt: string | null;
  externalEventId: string | null;
  createdAt: string;
}

export interface TelemetrySeriesPoint {
  at: string;
  value: number;
}

export interface ClimateSensorOption {
  id: string;
  name: string;
  room: string;
  sourceKind: Extract<DeviceSourceKind, "home_sensor" | "open_meteo">;
}

export interface ClimateSensorSelection {
  temperatureSensorId: string | null;
  humiditySensorId: string | null;
}

export interface HomeLocation {
  userId: string;
  hubId: string;
  latitude: number;
  longitude: number;
  accuracyMeters: number | null;
  timezone: string;
  label: string | null;
  source: "browser" | "manual" | "geocoding";
  updatedAt: string;
}

export interface NotificationItem {
  id: string;
  title: string;
  type: "temperature" | "motion" | "system" | "device" | "scenario";
  unread: boolean;
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

export interface ReportParameterDefinition {
  key: ReportParameterKey;
  label: string;
  kind: ReportParameterKind;
  required: boolean;
}

export interface ReportCatalogItem {
  kind: ReportKind;
  title: string;
  description: string;
  premiumOnly: boolean;
  available: boolean;
  parameters: ReportParameterDefinition[];
}

export interface ReportParameters {
  deviceId?: string | null;
  sensorId?: string | null;
  roomA?: string | null;
  roomB?: string | null;
}

export interface ReportMetricItem {
  label: string;
  value: string;
  subtitle: string;
}

export interface ReportSeries {
  label: string;
  unit: string | null;
  points: Array<{ at: string; label: string; value: number }>;
}

export type ReportBlock =
  | {
      type: "metrics";
      title: string;
      items: ReportMetricItem[];
    }
  | {
      type: "line_chart";
      title: string;
      description: string;
      series: ReportSeries[];
    }
  | {
      type: "bar_chart";
      title: string;
      description: string;
      items: Array<{ label: string; value: number }>;
    }
  | {
      type: "table";
      title: string;
      description: string;
      columns: string[];
      rows: string[][];
    };

export interface ReportPayload {
  kind: ReportKind;
  title: string;
  description: string;
  premiumOnly: boolean;
  range: DateRange;
  generatedAt: string;
  summary: string;
  parameters: ReportParameters;
  blocks: ReportBlock[];
}

export interface ClimateSeriesPayload {
  range: DateRange;
  temperatureSeries: TelemetrySeriesPoint[];
  humiditySeries: TelemetrySeriesPoint[];
  availableSensors: {
    temperature: ClimateSensorOption[];
    humidity: ClimateSensorOption[];
  };
  selectedSensors: ClimateSensorSelection;
}

export interface NewsItem {
  id: string;
  title: string;
  source: string;
  url: string;
  publishedAt: string | null;
}

export interface WeatherSnapshot {
  temperature: number;
  humidity: number;
  apparentTemperature: number;
  precipitation: number;
  windSpeed: number;
  weatherCode: number;
  shortwaveRadiation: number | null;
  observedAt: string;
  updatedAt: string;
  locationLabel: string | null;
}

export interface ScenarioEvaluation {
  scenario: Scenario;
  status: "matched" | "not_matched" | "unknown" | "unsupported";
  actualValue: number | null;
  unit: string | null;
  targetDeviceId: string | null;
  targetDeviceName: string;
  targetEnabled: boolean | null;
  applied: boolean;
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
  activitySeries: Array<{ day: string; events: number }>;
  currentScenario: Scenario | null;
  favoriteManualScenarios: Scenario[];
  subscription: Subscription;
  weather: WeatherSnapshot | null;
  scenarioEvaluation: ScenarioEvaluation | null;
}
