import { randomUUID } from "node:crypto";
import type { Pool } from "pg";
import type {
  Device,
  DeviceCategory,
  DeviceSourceKind,
  DeviceSourceMetric,
  DeviceType,
  HomeLocation,
  NotificationItem,
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
  source_kind: DeviceSourceKind;
  source_metric: DeviceSourceMetric | null;
  is_system: number;
  last_seen: string;
  created_at: string;
};

type ScenarioRow = {
  id: string;
  title: string;
  trigger_type: ScenarioTriggerType;
  automation_source: ScenarioAutomationSource;
  favorite: number;
  metric: ScenarioMetric;
  operator: ScenarioOperator;
  value: number;
  unit: string | null;
  source_device_id: string | null;
  source_device_name: string | null;
  source_metric: string | null;
  schedule_time: string | null;
  schedule_timezone: string | null;
  last_schedule_run_at: string | null;
  target_device_id: string | null;
  target_device_name: string;
  command: ScenarioCommand;
  active: number;
  last_evaluation_status: ScenarioLastEvaluation["status"] | null;
  last_actual_value: number | null;
  last_actual_unit: string | null;
  last_evaluation_reason: string | null;
  last_evaluated_at: string | null;
  last_applied: number;
  created_at: string;
};

type ScenarioActionRow = {
  id: string;
  target_device_id: string | null;
  target_device_name: string;
  command: ScenarioCommand;
  order_index: number;
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
  source: TelemetrySource;
  external_observed_at: string | null;
  external_event_id: string | null;
  created_at: string;
};

type HomeLocationRow = {
  user_id: string;
  hub_id: string;
  latitude: number;
  longitude: number;
  accuracy_meters: number | null;
  timezone: string;
  label: string | null;
  source: HomeLocation["source"];
  updated_at: string;
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
  ): Promise<Device> {
    const id = input.id ?? randomUUID();
    const now = new Date().toISOString();

    await this.db.query(
      `INSERT INTO devices
       (id, user_id, name, type, category, room, online, enabled, metric, source_kind, source_metric, is_system, last_seen, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
      [
        id,
        userId,
        input.name,
        input.type,
        input.category,
        input.room,
        1,
        input.enabled ? 1 : 0,
        input.metric ?? null,
        input.sourceKind ?? "manual",
        input.sourceMetric ?? null,
        input.isSystem ? 1 : 0,
        now,
        now
      ]
    );

    return (await this.getDevice(userId, id))!;
  }

  async updateDevice(
    userId: string,
    id: string,
    input: Partial<Pick<Device, "name" | "type" | "category" | "room" | "online" | "enabled" | "metric">>
  ): Promise<Device | null> {
    const current = await this.getDevice(userId, id);
    if (!current) {
      return null;
    }

    const next = {
      name: input.name ?? current.name,
      type: input.type ?? current.type,
      category: input.category ?? current.category,
      room: input.room ?? current.room,
      online: input.online ?? current.online,
      enabled: input.enabled ?? current.enabled,
      metric: input.metric === undefined ? current.metric : input.metric,
      lastSeen: new Date().toISOString()
    };

    await this.db.query(
      `UPDATE devices
       SET name = $1, type = $2, category = $3, room = $4, online = $5, enabled = $6, metric = $7, last_seen = $8
       WHERE user_id = $9 AND id = $10`,
      [next.name, next.type, next.category, next.room, next.online ? 1 : 0, next.enabled ? 1 : 0, next.metric, next.lastSeen, userId, id]
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
    return Promise.all(result.rows.map(async (row) => mapScenario(row, await this.listScenarioActions(userId, row.id))));
  }

  async getScenario(userId: string, id: string): Promise<Scenario | null> {
    const result = await this.db.query<ScenarioRow>("SELECT * FROM scenarios WHERE user_id = $1 AND id = $2", [userId, id]);
    return result.rows[0] ? mapScenario(result.rows[0], await this.listScenarioActions(userId, id)) : null;
  }

  async createScenario(
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
  ): Promise<Scenario> {
    const id = randomUUID();
    const now = new Date().toISOString();

    await this.db.query(
      `INSERT INTO scenarios
       (id, user_id, title, trigger_type, automation_source, favorite, metric, operator, value, unit, source_device_id, source_device_name, source_metric, schedule_time, schedule_timezone, last_schedule_run_at, target_device_id, target_device_name, command, active, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21)`,
      [
        id,
        userId,
        input.title,
        input.triggerType ?? "automatic",
        input.automationSource ?? "sensor",
        input.favorite ? 1 : 0,
        input.metric,
        input.operator,
        input.value,
        input.unit,
        input.sourceDeviceId ?? null,
        input.sourceDeviceName ?? null,
        input.sourceMetric ?? null,
        input.scheduleTime ?? null,
        input.scheduleTimezone ?? null,
        input.lastScheduleRunAt ?? null,
        input.targetDeviceId,
        input.targetDeviceName,
        input.command,
        input.active === false ? 0 : 1,
        now
      ]
    );

    await this.replaceScenarioActions(userId, id, input.actions ?? []);
    return (await this.getScenario(userId, id))!;
  }

  async updateScenario(
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
  ): Promise<Scenario | null> {
    const current = await this.getScenario(userId, id);
    if (!current) {
      return null;
    }

    await this.db.query(
      `UPDATE scenarios
       SET title = $1, trigger_type = $2, automation_source = $3, favorite = $4, metric = $5, operator = $6, value = $7, unit = $8, source_device_id = $9, source_device_name = $10, source_metric = $11, schedule_time = $12, schedule_timezone = $13, last_schedule_run_at = $14, target_device_id = $15, target_device_name = $16, command = $17, active = $18
       WHERE user_id = $19 AND id = $20`,
      [
        input.title ?? current.title,
        input.triggerType ?? current.triggerType,
        input.automationSource ?? current.automationSource,
        (input.favorite ?? current.favorite) ? 1 : 0,
        input.metric ?? current.metric,
        input.operator ?? current.operator,
        input.value ?? current.value,
        input.unit === undefined ? current.unit : input.unit,
        input.sourceDeviceId === undefined ? current.sourceDeviceId : input.sourceDeviceId,
        input.sourceDeviceName === undefined ? current.sourceDeviceName : input.sourceDeviceName,
        input.sourceMetric === undefined ? current.sourceMetric : input.sourceMetric,
        input.scheduleTime === undefined ? current.scheduleTime : input.scheduleTime,
        input.scheduleTimezone === undefined ? current.scheduleTimezone : input.scheduleTimezone,
        input.lastScheduleRunAt === undefined ? current.lastScheduleRunAt : input.lastScheduleRunAt,
        input.targetDeviceId === undefined ? current.targetDeviceId : input.targetDeviceId,
        input.targetDeviceName ?? current.targetDeviceName,
        input.command ?? current.command,
        (input.active ?? current.active) ? 1 : 0,
        userId,
        id
      ]
    );

    if (input.actions) {
      await this.replaceScenarioActions(userId, id, input.actions);
    }

    return this.getScenario(userId, id);
  }

  async updateScenarioEvaluation(userId: string, id: string, evaluation: ScenarioLastEvaluation): Promise<Scenario | null> {
    await this.db.query(
      `UPDATE scenarios
       SET last_evaluation_status = $1, last_actual_value = $2, last_actual_unit = $3, last_evaluation_reason = $4, last_evaluated_at = $5, last_applied = $6
       WHERE user_id = $7 AND id = $8`,
      [
        evaluation.status,
        evaluation.actualValue,
        evaluation.unit,
        evaluation.reason,
        evaluation.evaluatedAt,
        evaluation.applied ? 1 : 0,
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

  async listLatestTelemetry(userId: string, limit = 300): Promise<TelemetryPoint[]> {
    const result = await this.db.query<TelemetryRow>(
      `SELECT *
       FROM (
         SELECT * FROM telemetry_points
         WHERE user_id = $1
         ORDER BY created_at DESC
         LIMIT $2
       ) recent
       ORDER BY created_at ASC`,
      [userId, limit]
    );
    return result.rows.map(mapTelemetry);
  }

  async listTelemetryRange(userId: string, range: { from: string; to: string }): Promise<TelemetryPoint[]> {
    const result = await this.db.query<TelemetryRow>(
      `SELECT * FROM telemetry_points
       WHERE user_id = $1 AND created_at >= $2 AND created_at <= $3
       ORDER BY created_at ASC`,
      [userId, range.from, range.to]
    );
    return result.rows.map(mapTelemetry);
  }

  async getHomeLocation(userId: string): Promise<HomeLocation | null> {
    const result = await this.db.query<HomeLocationRow>("SELECT * FROM home_locations WHERE user_id = $1", [userId]);
    return result.rows[0] ? mapHomeLocation(result.rows[0]) : null;
  }

  async upsertHomeLocation(
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
  ): Promise<HomeLocation> {
    const updatedAt = new Date().toISOString();
    await this.db.query(
      `INSERT INTO home_locations
       (user_id, hub_id, latitude, longitude, accuracy_meters, timezone, label, source, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       ON CONFLICT(user_id) DO UPDATE SET
         hub_id = EXCLUDED.hub_id,
         latitude = EXCLUDED.latitude,
         longitude = EXCLUDED.longitude,
         accuracy_meters = EXCLUDED.accuracy_meters,
         timezone = EXCLUDED.timezone,
         label = EXCLUDED.label,
         source = EXCLUDED.source,
         updated_at = EXCLUDED.updated_at`,
      [userId, input.hubId, input.latitude, input.longitude, input.accuracyMeters, input.timezone, input.label, input.source, updatedAt]
    );

    return (await this.getHomeLocation(userId))!;
  }

  async createTelemetry(
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
  ): Promise<TelemetryPoint> {
    const id = randomUUID();
    const createdAt = new Date().toISOString();

    const result = await this.db.query<TelemetryRow>(
      `INSERT INTO telemetry_points
       (id, user_id, device_id, kind, value, unit, source, external_observed_at, external_event_id, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       ON CONFLICT (external_event_id) DO NOTHING
       RETURNING *`,
      [
        id,
        userId,
        input.deviceId,
        input.kind,
        input.value,
        input.unit,
        input.source ?? "manual",
        input.externalObservedAt ?? null,
        input.externalEventId ?? null,
        createdAt
      ]
    );

    await this.updateDevice(userId, input.deviceId, {
      metric: `${input.value}${input.unit ?? ""}`,
      online: true
    });

    if (result.rows[0]) {
      return mapTelemetry(result.rows[0]);
    }

    if (input.externalEventId) {
      const existing = await this.db.query<TelemetryRow>("SELECT * FROM telemetry_points WHERE external_event_id = $1", [input.externalEventId]);
      if (existing.rows[0]) {
        return mapTelemetry(existing.rows[0]);
      }
    }

    throw new Error("Не удалось сохранить телеметрию");
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

  private async listScenarioActions(userId: string, scenarioId: string): Promise<ScenarioAction[]> {
    const result = await this.db.query<ScenarioActionRow>(
      "SELECT * FROM scenario_actions WHERE user_id = $1 AND scenario_id = $2 ORDER BY order_index ASC, created_at ASC",
      [userId, scenarioId]
    );
    return result.rows.map(mapScenarioAction);
  }

  private async replaceScenarioActions(userId: string, scenarioId: string, actions: Array<Omit<ScenarioAction, "id">>) {
    const now = new Date().toISOString();
    await this.db.query("DELETE FROM scenario_actions WHERE user_id = $1 AND scenario_id = $2", [userId, scenarioId]);
    for (const action of actions) {
      await this.db.query(
        `INSERT INTO scenario_actions
         (id, user_id, scenario_id, target_device_id, target_device_name, command, order_index, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [randomUUID(), userId, scenarioId, action.targetDeviceId, action.targetDeviceName, action.command, action.orderIndex, now]
      );
    }
  }
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
    sourceKind: row.source_kind ?? "manual",
    sourceMetric: row.source_metric ?? null,
    isSystem: Boolean(row.is_system),
    lastSeen: row.last_seen,
    createdAt: row.created_at
  };
}

function mapScenario(row: ScenarioRow, actions: ScenarioAction[]): Scenario {
  const unit = row.unit ?? "";
  const condition =
    row.trigger_type === "manual"
      ? "Ручной запуск"
      : row.automation_source === "schedule"
        ? `Каждый день в ${row.schedule_time ?? "—"}`
      : `Если ${row.source_device_name ? `${row.source_device_name.toLowerCase()}: ` : ""}${row.metric.toLowerCase()} ${row.operator} ${row.value}${unit}`;
  const action =
    row.trigger_type === "manual"
      ? actions.length > 0
        ? `${actions.length} ${pluralize(actions.length, "действие", "действия", "действий")}`
        : "Нет действий"
      : `${row.command} ${row.target_device_name.toLowerCase()}`;

  return {
    id: row.id,
    title: row.title,
    triggerType: row.trigger_type ?? "automatic",
    automationSource: row.automation_source ?? "sensor",
    favorite: Boolean(row.favorite),
    metric: row.metric,
    operator: row.operator,
    value: Number(row.value),
    unit: row.unit,
    sourceDeviceId: row.source_device_id,
    sourceDeviceName: row.source_device_name,
    sourceMetric: row.source_metric,
    scheduleTime: row.schedule_time,
    scheduleTimezone: row.schedule_timezone,
    lastScheduleRunAt: row.last_schedule_run_at,
    targetDeviceId: row.target_device_id,
    targetDeviceName: row.target_device_name,
    command: row.command,
    active: Boolean(row.active),
    actions,
    lastEvaluation: {
      status: row.last_evaluation_status ?? "unknown",
      actualValue: row.last_actual_value === null ? null : Number(row.last_actual_value),
      unit: row.last_actual_unit ?? row.unit,
      reason: row.last_evaluation_reason,
      evaluatedAt: row.last_evaluated_at,
      applied: Boolean(row.last_applied)
    },
    condition,
    action,
    createdAt: row.created_at
  };
}

function mapScenarioAction(row: ScenarioActionRow): ScenarioAction {
  return {
    id: row.id,
    targetDeviceId: row.target_device_id,
    targetDeviceName: row.target_device_name,
    command: row.command,
    orderIndex: row.order_index
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
    source: row.source,
    externalObservedAt: row.external_observed_at,
    externalEventId: row.external_event_id,
    createdAt: row.created_at
  };
}

function pluralize(count: number, one: string, few: string, many: string) {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
  return many;
}

function mapHomeLocation(row: HomeLocationRow): HomeLocation {
  return {
    userId: row.user_id,
    hubId: row.hub_id,
    latitude: Number(row.latitude),
    longitude: Number(row.longitude),
    accuracyMeters: row.accuracy_meters === null ? null : Number(row.accuracy_meters),
    timezone: row.timezone,
    label: row.label,
    source: row.source,
    updatedAt: row.updated_at
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
