import { randomUUID } from "node:crypto";
import type { Pool } from "pg";
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
import type { HomeStore } from "./contracts.js";

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

export class PostgresHomeRepository implements HomeStore {
  constructor(private readonly db: Pool) {}

  async listDevices(userId: string): Promise<Device[]> {
    const result = await this.db.query<DeviceRow>("SELECT * FROM devices WHERE user_id = $1 ORDER BY created_at DESC", [userId]);
    return result.rows.map(mapDevice);
  }

  async getDevice(userId: string, id: string): Promise<Device | null> {
    const result = await this.db.query<DeviceRow>("SELECT * FROM devices WHERE user_id = $1 AND id = $2", [userId, id]);
    return result.rows[0] ? mapDevice(result.rows[0]) : null;
  }

  async createDevice(
    userId: string,
    input: {
      name: string;
      type: DeviceType;
      category: DeviceCategory;
      room: string;
      enabled?: boolean;
      metric?: string | null;
    }
  ): Promise<Device> {
    const id = randomUUID();
    const now = new Date().toISOString();

    await this.db.query(
      `INSERT INTO devices
       (id, user_id, name, type, category, room, online, enabled, metric, last_seen, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      [id, userId, input.name, input.type, input.category, input.room, 1, input.enabled ? 1 : 0, input.metric ?? null, now, now]
    );

    return (await this.getDevice(userId, id))!;
  }

  async updateDevice(
    userId: string,
    id: string,
    input: Partial<Pick<Device, "name" | "category" | "room" | "online" | "enabled" | "metric">>
  ): Promise<Device | null> {
    const current = await this.getDevice(userId, id);
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

    await this.db.query(
      `UPDATE devices
       SET name = $1, category = $2, room = $3, online = $4, enabled = $5, metric = $6, last_seen = $7
       WHERE user_id = $8 AND id = $9`,
      [next.name, next.category, next.room, next.online ? 1 : 0, next.enabled ? 1 : 0, next.metric, next.lastSeen, userId, id]
    );

    return this.getDevice(userId, id);
  }

  async deleteDevice(userId: string, id: string): Promise<Device | null> {
    const current = await this.getDevice(userId, id);
    if (!current) {
      return null;
    }

    await this.db.query("DELETE FROM devices WHERE user_id = $1 AND id = $2", [userId, id]);
    return current;
  }

  async listScenarios(userId: string): Promise<Scenario[]> {
    const result = await this.db.query<ScenarioRow>("SELECT * FROM scenarios WHERE user_id = $1 ORDER BY created_at DESC", [userId]);
    return result.rows.map(mapScenario);
  }

  async getScenario(userId: string, id: string): Promise<Scenario | null> {
    const result = await this.db.query<ScenarioRow>("SELECT * FROM scenarios WHERE user_id = $1 AND id = $2", [userId, id]);
    return result.rows[0] ? mapScenario(result.rows[0]) : null;
  }

  async createScenario(
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
  ): Promise<Scenario> {
    const id = randomUUID();
    const now = new Date().toISOString();

    await this.db.query(
      `INSERT INTO scenarios
       (id, user_id, title, metric, operator, value, unit, target_device_id, target_device_name, command, active, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
      [
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
      ]
    );

    return (await this.getScenario(userId, id))!;
  }

  async updateScenario(
    userId: string,
    id: string,
    input: Partial<Pick<Scenario, "title" | "metric" | "operator" | "value" | "unit" | "targetDeviceId" | "targetDeviceName" | "command" | "active">>
  ): Promise<Scenario | null> {
    const current = await this.getScenario(userId, id);
    if (!current) {
      return null;
    }

    await this.db.query(
      `UPDATE scenarios
       SET title = $1, metric = $2, operator = $3, value = $4, unit = $5, target_device_id = $6, target_device_name = $7, command = $8, active = $9
       WHERE user_id = $10 AND id = $11`,
      [
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
      ]
    );

    return this.getScenario(userId, id);
  }

  async deleteScenario(userId: string, id: string): Promise<Scenario | null> {
    const current = await this.getScenario(userId, id);
    if (!current) {
      return null;
    }

    await this.db.query("DELETE FROM scenarios WHERE user_id = $1 AND id = $2", [userId, id]);
    return current;
  }

  async listNotifications(userId: string): Promise<NotificationItem[]> {
    const result = await this.db.query<NotificationRow>("SELECT * FROM notifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT 100", [userId]);
    return result.rows.map(mapNotification);
  }

  async createNotification(userId: string, title: string, type: NotificationItem["type"] = "system", unread = true): Promise<NotificationItem> {
    const id = randomUUID();
    const createdAt = new Date().toISOString();

    await this.db.query("INSERT INTO notifications (id, user_id, title, type, unread, created_at) VALUES ($1, $2, $3, $4, $5, $6)", [
      id,
      userId,
      title,
      type,
      unread ? 1 : 0,
      createdAt
    ]);

    return {
      id,
      title,
      type,
      unread,
      createdAt
    };
  }

  async markNotificationRead(userId: string, id: string): Promise<NotificationItem | null> {
    await this.db.query("UPDATE notifications SET unread = 0 WHERE user_id = $1 AND id = $2", [userId, id]);
    const result = await this.db.query<NotificationRow>("SELECT * FROM notifications WHERE user_id = $1 AND id = $2", [userId, id]);
    return result.rows[0] ? mapNotification(result.rows[0]) : null;
  }

  async listTelemetry(userId: string): Promise<TelemetryPoint[]> {
    const result = await this.db.query<TelemetryRow>("SELECT * FROM telemetry_points WHERE user_id = $1 ORDER BY created_at ASC LIMIT 300", [userId]);
    return result.rows.map(mapTelemetry);
  }

  async createTelemetry(
    userId: string,
    input: {
      deviceId: string;
      kind: string;
      value: number;
      unit: string | null;
    }
  ): Promise<TelemetryPoint> {
    const id = randomUUID();
    const createdAt = new Date().toISOString();

    await this.db.query("INSERT INTO telemetry_points (id, user_id, device_id, kind, value, unit, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7)", [
      id,
      userId,
      input.deviceId,
      input.kind,
      input.value,
      input.unit,
      createdAt
    ]);

    await this.updateDevice(userId, input.deviceId, {
      metric: `${input.value}${input.unit ?? ""}`,
      online: true
    });

    return {
      id,
      deviceId: input.deviceId,
      kind: input.kind,
      value: input.value,
      unit: input.unit,
      createdAt
    };
  }

  async applyQuickAction(userId: string, action: QuickActionKind): Promise<Device[]> {
    const devices = await this.listDevices(userId);
    const now = new Date().toISOString();

    for (const device of devices) {
      const nextEnabled = resolveQuickActionState(action, device);
      if (nextEnabled !== null) {
        await this.db.query("UPDATE devices SET enabled = $1, last_seen = $2 WHERE user_id = $3 AND id = $4", [
          nextEnabled ? 1 : 0,
          now,
          userId,
          device.id
        ]);
      }
    }

    return this.listDevices(userId);
  }

  async getSubscription(userId: string): Promise<Subscription> {
    const result = await this.db.query<SubscriptionRow>("SELECT * FROM subscriptions WHERE user_id = $1", [userId]);
    return mapSubscription(result.rows[0]);
  }

  async upsertSubscription(
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
  ): Promise<Subscription> {
    const now = new Date().toISOString();
    await this.db.query(
      `INSERT INTO subscriptions
       (user_id, plan, status, started_at, expires_at, cancelled_at, payment_mock_last4, payment_email, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       ON CONFLICT(user_id) DO UPDATE SET
         plan = EXCLUDED.plan,
         status = EXCLUDED.status,
         started_at = EXCLUDED.started_at,
         expires_at = EXCLUDED.expires_at,
         cancelled_at = EXCLUDED.cancelled_at,
         payment_mock_last4 = EXCLUDED.payment_mock_last4,
         payment_email = EXCLUDED.payment_email,
         updated_at = EXCLUDED.updated_at`,
      [userId, input.plan, input.status, input.startedAt, input.expiresAt, input.cancelledAt, input.paymentMockLast4, input.paymentEmail, now, now]
    );

    return this.getSubscription(userId);
  }

  async getTelegramIntegration(userId: string): Promise<TelegramIntegration> {
    const result = await this.db.query<TelegramRow>("SELECT * FROM telegram_integrations WHERE user_id = $1", [userId]);
    return mapTelegram(result.rows[0]);
  }

  async getTelegramSecrets(userId: string): Promise<{ botTokenEncrypted: string; chatId: string } | null> {
    const result = await this.db.query<{ bot_token_encrypted: string; chat_id: string }>(
      "SELECT bot_token_encrypted, chat_id FROM telegram_integrations WHERE user_id = $1",
      [userId]
    );
    const row = result.rows[0];
    return row ? { botTokenEncrypted: row.bot_token_encrypted, chatId: row.chat_id } : null;
  }

  async upsertTelegramIntegration(userId: string, input: { botTokenEncrypted: string; chatId: string }): Promise<TelegramIntegration> {
    const now = new Date().toISOString();
    await this.db.query(
      `INSERT INTO telegram_integrations (user_id, bot_token_encrypted, chat_id, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT(user_id) DO UPDATE SET
         bot_token_encrypted = EXCLUDED.bot_token_encrypted,
         chat_id = EXCLUDED.chat_id,
         updated_at = EXCLUDED.updated_at`,
      [userId, input.botTokenEncrypted, input.chatId, now, now]
    );

    return this.getTelegramIntegration(userId);
  }

  async deleteTelegramIntegration(userId: string): Promise<void> {
    await this.db.query("DELETE FROM telegram_integrations WHERE user_id = $1", [userId]);
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
    value: Number(row.value),
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
    value: Number(row.value),
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
