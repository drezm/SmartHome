import type {
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
  User,
  UserWithPassword
} from "../domain/types.js";

export type MaybePromise<T> = T | Promise<T>;

export interface UserStore {
  findByEmail(email: string): MaybePromise<UserWithPassword | null>;
  findById(id: string): MaybePromise<User | null>;
  create(input: { name: string; email: string; passwordHash: string }): MaybePromise<User>;
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
  updateScenario(userId: string, id: string, input: Partial<Pick<Scenario, "title" | "active">>): MaybePromise<Scenario | null>;
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
}
