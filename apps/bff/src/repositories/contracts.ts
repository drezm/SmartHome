import type {
  Device,
  DeviceCategory,
  DeviceSourceKind,
  DeviceSourceMetric,
  DeviceType,
  DateRange,
  HomeLocation,
  NotificationItem,
  ReportCatalogItem,
  ReportKind,
  ReportPayload,
  Scenario,
  ScenarioAction,
  ScenarioAutomationSource,
  ScenarioCommand,
  ScenarioLastEvaluation,
  ScenarioMetric,
  ScenarioOperator,
  ScenarioTriggerType,
  Subscription,
  TelemetrySource,
  TelemetryPoint,
  TelegramIntegration,
  User,
  UserWithPassword
} from "../domain/types.js";

export type MaybePromise<T> = T | Promise<T>;

export interface UserStore {
  findByEmail(email: string): MaybePromise<UserWithPassword | null>;
  findById(id: string): MaybePromise<User | null>;
  findByHubId(hubId: string): MaybePromise<User | null>;
  listAll(): MaybePromise<User[]>;
  create(input: { name: string; email: string; passwordHash: string }): MaybePromise<User>;
  updatePassword(userId: string, passwordHash: string): MaybePromise<void>;
  createPasswordReset(input: { userId: string; tokenHash: string; expiresAt: string }): MaybePromise<void>;
  findPasswordReset(tokenHash: string): MaybePromise<{ id: string; userId: string; expiresAt: string; consumedAt: string | null } | null>;
  consumePasswordReset(id: string): MaybePromise<void>;
}

export interface HomeStore {
  listDevices(userId: string): MaybePromise<Device[]>;
  getDevice(userId: string, id: string): MaybePromise<Device | null>;
  createDevice(
    userId: string,
    input: {
      id?: string;
      name: string;
      type: DeviceType;
      category: DeviceCategory;
      room: string;
      enabled?: boolean;
      metric?: string | null;
      sourceKind?: DeviceSourceKind;
      sourceMetric?: DeviceSourceMetric | null;
      isSystem?: boolean;
    }
  ): MaybePromise<Device>;
  updateDevice(
    userId: string,
    id: string,
    input: Partial<Pick<Device, "name" | "type" | "category" | "room" | "online" | "enabled" | "metric">>
  ): MaybePromise<Device | null>;
  deleteDevice(userId: string, id: string): MaybePromise<Device | null>;
  listScenarios(userId: string): MaybePromise<Scenario[]>;
  getScenario(userId: string, id: string): MaybePromise<Scenario | null>;
  createScenario(
    userId: string,
    input: {
      title: string;
      triggerType?: ScenarioTriggerType;
      automationSource?: ScenarioAutomationSource;
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
      lastScheduleRunAt?: string | null;
      targetDeviceId: string | null;
      targetDeviceName: string;
      command: ScenarioCommand;
      active?: boolean;
      actions?: Array<Omit<ScenarioAction, "id">>;
    }
  ): MaybePromise<Scenario>;
  updateScenario(
    userId: string,
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
        | "lastScheduleRunAt"
        | "targetDeviceId"
        | "targetDeviceName"
        | "command"
        | "active"
      >
    > & { actions?: Array<Omit<ScenarioAction, "id">> }
  ): MaybePromise<Scenario | null>;
  updateScenarioEvaluation(userId: string, id: string, evaluation: ScenarioLastEvaluation): MaybePromise<Scenario | null>;
  deleteScenario(userId: string, id: string): MaybePromise<Scenario | null>;
  listNotifications(userId: string): MaybePromise<NotificationItem[]>;
  createNotification(userId: string, title: string, type?: NotificationItem["type"], unread?: boolean): MaybePromise<NotificationItem>;
  markNotificationRead(userId: string, id: string): MaybePromise<NotificationItem | null>;
  listLatestTelemetry(userId: string, limit?: number): MaybePromise<TelemetryPoint[]>;
  listTelemetryRange(userId: string, range: Pick<DateRange, "from" | "to">): MaybePromise<TelemetryPoint[]>;
  getHomeLocation(userId: string): MaybePromise<HomeLocation | null>;
  upsertHomeLocation(
    userId: string,
    input: {
      hubId: string;
      latitude: number;
      longitude: number;
      accuracyMeters: number | null;
      timezone: string;
      label: string | null;
      source: HomeLocation["source"];
    }
  ): MaybePromise<HomeLocation>;
  createTelemetry(
    userId: string,
    input: {
      deviceId: string;
      kind: string;
      value: number;
      unit: string | null;
      source?: TelemetrySource;
      externalObservedAt?: string | null;
      externalEventId?: string | null;
    }
  ): MaybePromise<TelemetryPoint>;
  getSubscription(userId: string): MaybePromise<Subscription>;
  upsertSubscription(
    userId: string,
    input: {
      plan: Subscription["plan"];
      status: Subscription["status"];
      startedAt: string | null;
      expiresAt: string | null;
      cancelledAt: string | null;
      paymentMockLast4: string | null;
      paymentEmail: string | null;
    }
  ): MaybePromise<Subscription>;
  getTelegramIntegration(userId: string): MaybePromise<TelegramIntegration>;
  getTelegramSecrets(userId: string): MaybePromise<{ botTokenEncrypted: string; chatId: string } | null>;
  upsertTelegramIntegration(userId: string, input: { botTokenEncrypted: string; chatId: string }): MaybePromise<TelegramIntegration>;
  deleteTelegramIntegration(userId: string): MaybePromise<void>;
}

export type { ReportCatalogItem, ReportKind, ReportPayload };
