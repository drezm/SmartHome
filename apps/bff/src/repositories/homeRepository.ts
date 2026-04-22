import { randomUUID } from "node:crypto";
import type { Database } from "better-sqlite3";
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
  Subscription,
  TelegramIntegration,
  TelemetryPoint
} from "../domain/types.js";

type DeviceRow = {
  id: string;
  name: string;
  type: DeviceType;
  category: DeviceCategory;
  room: string;
  online: number;
  enabled: number;
  metric: string | null;
  last_seen: string;
  created_at: string;
};

type ScenarioRow = {
  id: string;
  title: string;
  metric: ScenarioMetric;
  operator: ScenarioOperator;
  value: number;
  unit: string | null;
  target_device_id: string | null;
  target_device_name: string;
  command: ScenarioCommand;
  active: number;
  created_at: string;
};

type NotificationRow = {
  id: string;
  title: string;
  type: NotificationItem["type"];
  unread: number;
  created_at: string;
};

type TelemetryRow = {
  id: string;
  device_id: string;
  kind: string;
  value: number;
  unit: string | null;
  created_at: string;
};

type SubscriptionRow = {
  plan: Subscription["plan"];
  status: Subscription["status"];
  started_at: string | null;
  expires_at: string | null;
  cancelled_at: string | null;
  payment_mock_last4: string | null;
  payment_email: string | null;
};

type TelegramRow = {
  bot_token_encrypted: string;
  chat_id: string;
  updated_at: string;
};

export class HomeRepository {
  constructor(private readonly db: Database) {}

  listDevices(userId: string): Device[] {
    const rows = this.db.prepare("SELECT * FROM devices WHERE user_id = ? ORDER BY created_at DESC").all(userId) as DeviceRow[];
    return rows.map(mapDevice);
  }

  getDevice(userId: string, id: string): Device | null {
    const row = this.db.prepare("SELECT * FROM devices WHERE user_id = ? AND id = ?").get(userId, id) as DeviceRow | undefined;
    return row ? mapDevice(row) : null;
  }

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
  ): Device {
    const now = new Date().toISOString();
    const id = randomUUID();

    this.db
      .prepare(
        `INSERT INTO devices
        (id, user_id, name, type, category, room, online, enabled, metric, last_seen, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(id, userId, input.name, input.type, input.category, input.room, 1, input.enabled ? 1 : 0, input.metric ?? null, now, now);

    return this.getDevice(userId, id)!;
  }

  updateDevice(
    userId: string,
    id: string,
    input: Partial<Pick<Device, "name" | "category" | "room" | "online" | "enabled" | "metric">>
  ): Device | null {
    const current = this.getDevice(userId, id);
    if (!current) {
      return null;
    }

    const next = {
      name: input.name ?? current.name,
      category: input.category ?? current.category,
      room: input.room ?? current.room,
      online: input.online ?? current.online,
      enabled: input.enabled ?? current.enabled,
      metric: input.metric === undefined ? current.metric : input.metric,
      lastSeen: new Date().toISOString()
    };

    this.db
      .prepare(
        `UPDATE devices
         SET name = ?, category = ?, room = ?, online = ?, enabled = ?, metric = ?, last_seen = ?
         WHERE user_id = ? AND id = ?`
      )
      .run(next.name, next.category, next.room, next.online ? 1 : 0, next.enabled ? 1 : 0, next.metric, next.lastSeen, userId, id);

    return this.getDevice(userId, id);
  }

  deleteDevice(userId: string, id: string): Device | null {
    const current = this.getDevice(userId, id);
    if (!current) {
      return null;
    }

    this.db.prepare("DELETE FROM devices WHERE user_id = ? AND id = ?").run(userId, id);
    return current;
  }

  listScenarios(userId: string): Scenario[] {
    const rows = this.db.prepare("SELECT * FROM scenarios WHERE user_id = ? ORDER BY created_at DESC").all(userId) as ScenarioRow[];
    return rows.map(mapScenario);
  }

  getScenario(userId: string, id: string): Scenario | null {
    const row = this.db.prepare("SELECT * FROM scenarios WHERE user_id = ? AND id = ?").get(userId, id) as ScenarioRow | undefined;
    return row ? mapScenario(row) : null;
  }

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
  ): Scenario {
    const id = randomUUID();
    const now = new Date().toISOString();

    this.db
      .prepare(
        `INSERT INTO scenarios
        (id, user_id, title, metric, operator, value, unit, target_device_id, target_device_name, command, active, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        id,
        userId,
        input.title,
        input.metric,
        input.operator,
        input.value,
        input.unit,
        input.targetDeviceId,
        input.targetDeviceName,
        input.command,
        input.active === false ? 0 : 1,
        now
      );

    return this.getScenario(userId, id)!;
  }

  updateScenario(
    userId: string,
    id: string,
    input: Partial<Pick<Scenario, "title" | "metric" | "operator" | "value" | "unit" | "targetDeviceId" | "targetDeviceName" | "command" | "active">>
  ): Scenario | null {
    const current = this.getScenario(userId, id);
    if (!current) {
      return null;
    }

    this.db
      .prepare(
        `UPDATE scenarios
         SET title = ?, metric = ?, operator = ?, value = ?, unit = ?, target_device_id = ?, target_device_name = ?, command = ?, active = ?
         WHERE user_id = ? AND id = ?`
      )
      .run(
        input.title ?? current.title,
        input.metric ?? current.metric,
        input.operator ?? current.operator,
        input.value ?? current.value,
        input.unit === undefined ? current.unit : input.unit,
        input.targetDeviceId === undefined ? current.targetDeviceId : input.targetDeviceId,
        input.targetDeviceName ?? current.targetDeviceName,
        input.command ?? current.command,
        (input.active ?? current.active) ? 1 : 0,
        userId,
        id
      );

    return this.getScenario(userId, id);
  }

  deleteScenario(userId: string, id: string): Scenario | null {
    const current = this.getScenario(userId, id);
    if (!current) {
      return null;
    }

    this.db.prepare("DELETE FROM scenarios WHERE user_id = ? AND id = ?").run(userId, id);
    return current;
  }

  listNotifications(userId: string): NotificationItem[] {
    const rows = this.db
      .prepare("SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 100")
      .all(userId) as NotificationRow[];
    return rows.map(mapNotification);
  }

  createNotification(userId: string, title: string, type: NotificationItem["type"] = "system", unread = true): NotificationItem {
    const id = randomUUID();
    const createdAt = new Date().toISOString();
    this.db
      .prepare("INSERT INTO notifications (id, user_id, title, type, unread, created_at) VALUES (?, ?, ?, ?, ?, ?)")
      .run(id, userId, title, type, unread ? 1 : 0, createdAt);

    return {
      id,
      title,
      type,
      unread,
      createdAt
    };
  }

  markNotificationRead(userId: string, id: string): NotificationItem | null {
    this.db.prepare("UPDATE notifications SET unread = 0 WHERE user_id = ? AND id = ?").run(userId, id);
    const row = this.db.prepare("SELECT * FROM notifications WHERE user_id = ? AND id = ?").get(userId, id) as NotificationRow | undefined;
    return row ? mapNotification(row) : null;
  }

  listTelemetry(userId: string): TelemetryPoint[] {
    const rows = this.db
      .prepare("SELECT * FROM telemetry_points WHERE user_id = ? ORDER BY created_at ASC LIMIT 300")
      .all(userId) as TelemetryRow[];
    return rows.map(mapTelemetry);
  }

  createTelemetry(
    userId: string,
    input: {
      deviceId: string;
      kind: string;
      value: number;
      unit: string | null;
    }
  ): TelemetryPoint {
    const id = randomUUID();
    const createdAt = new Date().toISOString();
    this.db
      .prepare("INSERT INTO telemetry_points (id, user_id, device_id, kind, value, unit, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)")
      .run(id, userId, input.deviceId, input.kind, input.value, input.unit, createdAt);

    const metric = `${input.value}${input.unit ?? ""}`;
    this.updateDevice(userId, input.deviceId, { metric, online: true });

    return {
      id,
      deviceId: input.deviceId,
      kind: input.kind,
      value: input.value,
      unit: input.unit,
      createdAt
    };
  }

  applyQuickAction(userId: string, action: QuickActionKind): Device[] {
    const devices = this.listDevices(userId);
    const now = new Date().toISOString();
    const statement = this.db.prepare("UPDATE devices SET enabled = ?, last_seen = ? WHERE user_id = ? AND id = ?");

    for (const device of devices) {
      const nextEnabled = resolveQuickActionState(action, device);
      if (nextEnabled !== null) {
        statement.run(nextEnabled ? 1 : 0, now, userId, device.id);
      }
    }

    return this.listDevices(userId);
  }

  getSubscription(userId: string): Subscription {
    const row = this.db.prepare("SELECT * FROM subscriptions WHERE user_id = ?").get(userId) as SubscriptionRow | undefined;
    return mapSubscription(row);
  }

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
  ): Subscription {
    const now = new Date().toISOString();
    this.db
      .prepare(
        `INSERT INTO subscriptions
        (user_id, plan, status, started_at, expires_at, cancelled_at, payment_mock_last4, payment_email, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(user_id) DO UPDATE SET
          plan = excluded.plan,
          status = excluded.status,
          started_at = excluded.started_at,
          expires_at = excluded.expires_at,
          cancelled_at = excluded.cancelled_at,
          payment_mock_last4 = excluded.payment_mock_last4,
          payment_email = excluded.payment_email,
          updated_at = excluded.updated_at`
      )
      .run(userId, input.plan, input.status, input.startedAt, input.expiresAt, input.cancelledAt, input.paymentMockLast4, input.paymentEmail, now, now);

    return this.getSubscription(userId);
  }

  getTelegramIntegration(userId: string): TelegramIntegration {
    const row = this.db.prepare("SELECT * FROM telegram_integrations WHERE user_id = ?").get(userId) as TelegramRow | undefined;
    return mapTelegram(row);
  }

  getTelegramSecrets(userId: string): { botTokenEncrypted: string; chatId: string } | null {
    const row = this.db.prepare("SELECT bot_token_encrypted, chat_id FROM telegram_integrations WHERE user_id = ?").get(userId) as
      | { bot_token_encrypted: string; chat_id: string }
      | undefined;
    return row ? { botTokenEncrypted: row.bot_token_encrypted, chatId: row.chat_id } : null;
  }

  upsertTelegramIntegration(userId: string, input: { botTokenEncrypted: string; chatId: string }): TelegramIntegration {
    const now = new Date().toISOString();
    this.db
      .prepare(
        `INSERT INTO telegram_integrations (user_id, bot_token_encrypted, chat_id, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(user_id) DO UPDATE SET
           bot_token_encrypted = excluded.bot_token_encrypted,
           chat_id = excluded.chat_id,
           updated_at = excluded.updated_at`
      )
      .run(userId, input.botTokenEncrypted, input.chatId, now, now);

    return this.getTelegramIntegration(userId);
  }

  deleteTelegramIntegration(userId: string): void {
    this.db.prepare("DELETE FROM telegram_integrations WHERE user_id = ?").run(userId);
  }
}

function resolveQuickActionState(action: QuickActionKind, device: Device): boolean | null {
  if (action === "TURN_OFF_ALL" || action === "NIGHT_MODE") {
    return false;
  }

  if (action === "TURN_ON_LIGHTS") {
    return device.category === "Освещение" ? true : null;
  }

  if (action === "MORNING_MODE") {
    return device.category === "Освещение" || device.category === "Климат" ? true : null;
  }

  return null;
}

function mapDevice(row: DeviceRow): Device {
  return {
    id: row.id,
    name: row.name,
    type: row.type,
    category: row.category,
    room: row.room,
    online: Boolean(row.online),
    enabled: Boolean(row.enabled),
    metric: row.metric,
    lastSeen: row.last_seen,
    createdAt: row.created_at
  };
}

function mapScenario(row: ScenarioRow): Scenario {
  const unit = row.unit ?? "";
  const condition = `Если ${row.metric.toLowerCase()} ${row.operator} ${row.value}${unit}`;
  const action = `${row.command} ${row.target_device_name.toLowerCase()}`;

  return {
    id: row.id,
    title: row.title,
    metric: row.metric,
    operator: row.operator,
    value: row.value,
    unit: row.unit,
    targetDeviceId: row.target_device_id,
    targetDeviceName: row.target_device_name,
    command: row.command,
    active: Boolean(row.active),
    condition,
    action,
    createdAt: row.created_at
  };
}

function mapNotification(row: NotificationRow): NotificationItem {
  return {
    id: row.id,
    title: row.title,
    type: row.type,
    unread: Boolean(row.unread),
    createdAt: row.created_at
  };
}

function mapTelemetry(row: TelemetryRow): TelemetryPoint {
  return {
    id: row.id,
    deviceId: row.device_id,
    kind: row.kind,
    value: row.value,
    unit: row.unit,
    createdAt: row.created_at
  };
}

function mapSubscription(row?: SubscriptionRow): Subscription {
  if (!row) {
    return {
      plan: "free",
      status: "free",
      startedAt: null,
      expiresAt: null,
      cancelledAt: null,
      paymentMockLast4: null,
      paymentEmail: null,
      isPremium: false,
      daysLeft: null
    };
  }

  const expiresAtMs = row.expires_at ? new Date(row.expires_at).getTime() : 0;
  const paidUntilFuture = expiresAtMs > Date.now();
  const isPaidStatus = row.status === "active" || row.status === "cancelled";
  const active = isPaidStatus && paidUntilFuture;
  const status = active ? row.status : isPaidStatus && row.expires_at ? "expired" : row.status;

  return {
    plan: active ? "premium" : row.plan,
    status,
    startedAt: row.started_at,
    expiresAt: row.expires_at,
    cancelledAt: row.cancelled_at,
    paymentMockLast4: row.payment_mock_last4,
    paymentEmail: row.payment_email,
    isPremium: active,
    daysLeft: active ? Math.max(0, Math.ceil((expiresAtMs - Date.now()) / 86_400_000)) : null
  };
}

function mapTelegram(row?: TelegramRow): TelegramIntegration {
  return {
    connected: Boolean(row),
    chatId: row?.chat_id ?? null,
    hasBotToken: Boolean(row?.bot_token_encrypted),
    updatedAt: row?.updated_at ?? null
  };
}
