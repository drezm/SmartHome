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

  async updateScenario(userId: string, id: string, input: Partial<Pick<Scenario, "title" | "active">>): Promise<Scenario | null> {
    const current = await this.getScenario(userId, id);
    if (!current) {
      return null;
    }

    await this.db.query("UPDATE scenarios SET title = $1, active = $2 WHERE user_id = $3 AND id = $4", [
      input.title ?? current.title,
      (input.active ?? current.active) ? 1 : 0,
      userId,
      id
    ]);

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
