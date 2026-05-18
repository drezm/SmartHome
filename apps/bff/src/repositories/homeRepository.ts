import { randomUUID } from "node:crypto";
import type { Database } from "better-sqlite3";
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
  source?: TelemetrySource;
  external_observed_at?: string | null;
  external_event_id?: string | null;
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
  ): Device {
    const now = new Date().toISOString();
    const id = input.id ?? randomUUID();

    this.db
      .prepare(
        `INSERT INTO devices
        (id, user_id, name, type, category, room, online, enabled, metric, source_kind, source_metric, is_system, last_seen, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
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
      );

    return this.getDevice(userId, id)!;
  }

  updateDevice(
    userId: string,
    id: string,
    input: Partial<Pick<Device, "name" | "type" | "category" | "room" | "online" | "enabled" | "metric">>
  ): Device | null {
    const current = this.getDevice(userId, id);
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

    this.db
      .prepare(
        `UPDATE devices
         SET name = ?, type = ?, category = ?, room = ?, online = ?, enabled = ?, metric = ?, last_seen = ?
         WHERE user_id = ? AND id = ?`
      )
      .run(next.name, next.type, next.category, next.room, next.online ? 1 : 0, next.enabled ? 1 : 0, next.metric, next.lastSeen, userId, id);

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
    return rows.map((row) => mapScenario(row, this.listScenarioActions(userId, row.id)));
  }

  getScenario(userId: string, id: string): Scenario | null {
    const row = this.db.prepare("SELECT * FROM scenarios WHERE user_id = ? AND id = ?").get(userId, id) as ScenarioRow | undefined;
    return row ? mapScenario(row, this.listScenarioActions(userId, row.id)) : null;
  }

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
  ): Scenario {
    const id = randomUUID();
    const now = new Date().toISOString();

    this.db
      .prepare(
        `INSERT INTO scenarios
        (id, user_id, title, trigger_type, automation_source, favorite, metric, operator, value, unit, source_device_id, source_device_name, source_metric, schedule_time, schedule_timezone, last_schedule_run_at, target_device_id, target_device_name, command, active, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
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
      );

    this.replaceScenarioActions(userId, id, input.actions ?? []);
    return this.getScenario(userId, id)!;
  }

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
  ): Scenario | null {
    const current = this.getScenario(userId, id);
    if (!current) {
      return null;
    }

    this.db
      .prepare(
        `UPDATE scenarios
         SET title = ?, trigger_type = ?, automation_source = ?, favorite = ?, metric = ?, operator = ?, value = ?, unit = ?, source_device_id = ?, source_device_name = ?, source_metric = ?, schedule_time = ?, schedule_timezone = ?, last_schedule_run_at = ?, target_device_id = ?, target_device_name = ?, command = ?, active = ?
         WHERE user_id = ? AND id = ?`
      )
      .run(
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
      );

    if (input.actions) {
      this.replaceScenarioActions(userId, id, input.actions);
    }

    return this.getScenario(userId, id);
  }

  updateScenarioEvaluation(userId: string, id: string, evaluation: ScenarioLastEvaluation): Scenario | null {
    this.db
      .prepare(
        `UPDATE scenarios
         SET last_evaluation_status = ?, last_actual_value = ?, last_actual_unit = ?, last_evaluation_reason = ?, last_evaluated_at = ?, last_applied = ?
         WHERE user_id = ? AND id = ?`
      )
      .run(
        evaluation.status,
        evaluation.actualValue,
        evaluation.unit,
        evaluation.reason,
        evaluation.evaluatedAt,
        evaluation.applied ? 1 : 0,
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

  listLatestTelemetry(userId: string, limit = 300): TelemetryPoint[] {
    const rows = this.db
      .prepare(
        `SELECT *
         FROM (
           SELECT * FROM telemetry_points
           WHERE user_id = ?
           ORDER BY created_at DESC
           LIMIT ?
         )
         ORDER BY created_at ASC`
      )
      .all(userId, limit) as TelemetryRow[];
    return rows.map(mapTelemetry);
  }

  listTelemetryRange(userId: string, range: { from: string; to: string }): TelemetryPoint[] {
    const rows = this.db
      .prepare(
        `SELECT * FROM telemetry_points
         WHERE user_id = ? AND created_at >= ? AND created_at <= ?
         ORDER BY created_at ASC`
      )
      .all(userId, range.from, range.to) as TelemetryRow[];
    return rows.map(mapTelemetry);
  }

  getHomeLocation(userId: string): HomeLocation | null {
    const row = this.db.prepare("SELECT * FROM home_locations WHERE user_id = ?").get(userId) as HomeLocationRow | undefined;
    return row ? mapHomeLocation(row) : null;
  }

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
  ): HomeLocation {
    const updatedAt = new Date().toISOString();
    this.db
      .prepare(
        `INSERT INTO home_locations
         (user_id, hub_id, latitude, longitude, accuracy_meters, timezone, label, source, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(user_id) DO UPDATE SET
           hub_id = excluded.hub_id,
           latitude = excluded.latitude,
           longitude = excluded.longitude,
           accuracy_meters = excluded.accuracy_meters,
           timezone = excluded.timezone,
           label = excluded.label,
           source = excluded.source,
           updated_at = excluded.updated_at`
      )
      .run(userId, input.hubId, input.latitude, input.longitude, input.accuracyMeters, input.timezone, input.label, input.source, updatedAt);

    return this.getHomeLocation(userId)!;
  }

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
  ): TelemetryPoint {
    const id = randomUUID();
    const createdAt = new Date().toISOString();
    const result = this.db
      .prepare(
        `INSERT OR IGNORE INTO telemetry_points
         (id, user_id, device_id, kind, value, unit, source, external_observed_at, external_event_id, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
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
      );

    const metric = `${input.value}${input.unit ?? ""}`;
    this.updateDevice(userId, input.deviceId, { metric, online: true });

    const row =
      result.changes > 0
        ? (this.db.prepare("SELECT * FROM telemetry_points WHERE id = ?").get(id) as TelemetryRow | undefined)
        : input.externalEventId
          ? (this.db.prepare("SELECT * FROM telemetry_points WHERE external_event_id = ?").get(input.externalEventId) as TelemetryRow | undefined)
          : undefined;

    if (!row) {
      throw new Error("Не удалось сохранить телеметрию");
    }

    return mapTelemetry(row);
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

  private listScenarioActions(userId: string, scenarioId: string): ScenarioAction[] {
    const rows = this.db
      .prepare("SELECT * FROM scenario_actions WHERE user_id = ? AND scenario_id = ? ORDER BY order_index ASC, created_at ASC")
      .all(userId, scenarioId) as ScenarioActionRow[];
    return rows.map(mapScenarioAction);
  }

  private replaceScenarioActions(userId: string, scenarioId: string, actions: Array<Omit<ScenarioAction, "id">>) {
    const now = new Date().toISOString();
    this.db.prepare("DELETE FROM scenario_actions WHERE user_id = ? AND scenario_id = ?").run(userId, scenarioId);
    const insert = this.db.prepare(
      `INSERT INTO scenario_actions
       (id, user_id, scenario_id, target_device_id, target_device_name, command, order_index, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    );

    for (const action of actions) {
      insert.run(randomUUID(), userId, scenarioId, action.targetDeviceId, action.targetDeviceName, action.command, action.orderIndex, now);
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
    value: row.value,
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
      actualValue: row.last_actual_value ?? null,
      unit: row.last_actual_unit ?? row.unit,
      reason: row.last_evaluation_reason ?? null,
      evaluatedAt: row.last_evaluated_at ?? null,
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
    value: row.value,
    unit: row.unit,
    source: row.source ?? "manual",
    externalObservedAt: row.external_observed_at ?? null,
    externalEventId: row.external_event_id ?? null,
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
