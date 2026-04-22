import type {
  Device,
  DeviceCategory,
  DeviceType,
  NotificationItem,
  QuickActionKind,
  ReportSummary,
  Scenario,
  ScenarioCommand,
  ScenarioMetric,
  ScenarioOperator,
  Subscription,
  TelemetryPoint,
  TelegramIntegration,
  User,
  UserWithPassword
} from "../domain/types.js";

export type MaybePromise<T> = T | Promise<T>;

export interface UserStore {
  findByEmail(email: string): MaybePromise<UserWithPassword | null>;
  findById(id: string): MaybePromise<User | null>;
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
      name: string;
      type: DeviceType;
      category: DeviceCategory;
      room: string;
      enabled?: boolean;
      metric?: string | null;
    }
  ): MaybePromise<Device>;
  updateDevice(
    userId: string,
    id: string,
    input: Partial<Pick<Device, "name" | "category" | "room" | "online" | "enabled" | "metric">>
  ): MaybePromise<Device | null>;
  deleteDevice(userId: string, id: string): MaybePromise<Device | null>;
  listScenarios(userId: string): MaybePromise<Scenario[]>;
  getScenario(userId: string, id: string): MaybePromise<Scenario | null>;
  createScenario(
    userId: string,
    input: {
      title: string;
      metric: ScenarioMetric;
      operator: ScenarioOperator;
      value: number;
      unit: string | null;
      targetDeviceId: string | null;
      targetDeviceName: string;
      command: ScenarioCommand;
      active?: boolean;
    }
  ): MaybePromise<Scenario>;
  updateScenario(
    userId: string,
    id: string,
    input: Partial<Pick<Scenario, "title" | "metric" | "operator" | "value" | "unit" | "targetDeviceId" | "targetDeviceName" | "command" | "active">>
  ): MaybePromise<Scenario | null>;
  deleteScenario(userId: string, id: string): MaybePromise<Scenario | null>;
  listNotifications(userId: string): MaybePromise<NotificationItem[]>;
  createNotification(userId: string, title: string, type?: NotificationItem["type"], unread?: boolean): MaybePromise<NotificationItem>;
  markNotificationRead(userId: string, id: string): MaybePromise<NotificationItem | null>;
  listTelemetry(userId: string): MaybePromise<TelemetryPoint[]>;
  createTelemetry(
    userId: string,
    input: {
      deviceId: string;
      kind: string;
      value: number;
      unit: string | null;
    }
  ): MaybePromise<TelemetryPoint>;
  applyQuickAction(userId: string, action: QuickActionKind): MaybePromise<Device[]>;
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

export type ReportRange = ReportSummary["range"];
