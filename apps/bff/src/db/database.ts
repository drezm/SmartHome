import Database from "better-sqlite3";
import bcrypt from "bcryptjs";
import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { env } from "../config/env.js";
import { buildHubId } from "../domain/hubId.js";

let database: Database.Database | null = null;

export function getDatabase() {
  if (!database) {
    database = openDatabase(env.DB_PATH);
  }

  return database;
}

export function resetDatabaseForTests(dbPath = ":memory:") {
  database?.close();
  database = openDatabase(dbPath);
  return database;
}

function openDatabase(dbPath: string) {
  if (dbPath !== ":memory:") {
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  }

  const db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  migrate(db);
  seedDemo(db);

  return db;
}

function migrate(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      hub_id TEXT UNIQUE,
      password_hash TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS devices (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      category TEXT NOT NULL,
      room TEXT NOT NULL,
      online INTEGER NOT NULL DEFAULT 1,
      enabled INTEGER NOT NULL DEFAULT 0,
      metric TEXT,
      source_kind TEXT NOT NULL DEFAULT 'manual',
      source_metric TEXT,
      is_system INTEGER NOT NULL DEFAULT 0,
      last_seen TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS scenarios (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      title TEXT NOT NULL,
      metric TEXT NOT NULL,
      operator TEXT NOT NULL,
      value REAL NOT NULL,
      unit TEXT,
      trigger_type TEXT NOT NULL DEFAULT 'automatic',
      automation_source TEXT NOT NULL DEFAULT 'sensor',
      favorite INTEGER NOT NULL DEFAULT 0,
      source_device_id TEXT,
      source_device_name TEXT,
      source_metric TEXT,
      schedule_time TEXT,
      schedule_timezone TEXT,
      last_schedule_run_at TEXT,
      target_device_id TEXT,
      target_device_name TEXT NOT NULL,
      command TEXT NOT NULL,
      active INTEGER NOT NULL DEFAULT 1,
      last_evaluation_status TEXT,
      last_actual_value REAL,
      last_actual_unit TEXT,
      last_evaluation_reason TEXT,
      last_evaluated_at TEXT,
      last_applied INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (source_device_id) REFERENCES devices(id) ON DELETE SET NULL,
      FOREIGN KEY (target_device_id) REFERENCES devices(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS scenario_actions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      scenario_id TEXT NOT NULL,
      target_device_id TEXT,
      target_device_name TEXT NOT NULL,
      command TEXT NOT NULL,
      order_index INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (scenario_id) REFERENCES scenarios(id) ON DELETE CASCADE,
      FOREIGN KEY (target_device_id) REFERENCES devices(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      title TEXT NOT NULL,
      type TEXT NOT NULL,
      unread INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS telemetry_points (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      device_id TEXT NOT NULL,
      kind TEXT NOT NULL,
      value REAL NOT NULL,
      unit TEXT,
      source TEXT NOT NULL DEFAULT 'manual',
      external_observed_at TEXT,
      external_event_id TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (device_id) REFERENCES devices(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS home_locations (
      user_id TEXT PRIMARY KEY,
      hub_id TEXT UNIQUE NOT NULL,
      latitude REAL NOT NULL,
      longitude REAL NOT NULL,
      accuracy_meters REAL,
      timezone TEXT NOT NULL DEFAULT 'Europe/Moscow',
      label TEXT,
      source TEXT NOT NULL DEFAULT 'browser',
      updated_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (hub_id) REFERENCES users(hub_id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS subscriptions (
      user_id TEXT PRIMARY KEY,
      plan TEXT NOT NULL DEFAULT 'free',
      status TEXT NOT NULL DEFAULT 'free',
      started_at TEXT,
      expires_at TEXT,
      cancelled_at TEXT,
      payment_mock_last4 TEXT,
      payment_email TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS telegram_integrations (
      user_id TEXT PRIMARY KEY,
      bot_token_encrypted TEXT NOT NULL,
      chat_id TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS password_reset_tokens (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      token_hash TEXT NOT NULL UNIQUE,
      expires_at TEXT NOT NULL,
      consumed_at TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_devices_user ON devices(user_id);
    CREATE INDEX IF NOT EXISTS idx_scenarios_user ON scenarios(user_id);
    CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
    CREATE INDEX IF NOT EXISTS idx_scenario_actions_scenario ON scenario_actions(scenario_id, order_index);
    CREATE INDEX IF NOT EXISTS idx_telemetry_user_device ON telemetry_points(user_id, device_id);
    CREATE INDEX IF NOT EXISTS idx_telemetry_user_device_created ON telemetry_points(user_id, device_id, created_at DESC);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_telemetry_external_event_id ON telemetry_points(external_event_id);
    CREATE INDEX IF NOT EXISTS idx_home_locations_hub_id ON home_locations(hub_id);
    CREATE INDEX IF NOT EXISTS idx_password_reset_token_hash ON password_reset_tokens(token_hash);
  `);

  ensureUsersHubIdColumn(db);
  ensureTelemetryPipelineColumns(db);
  ensureScenarioSourceColumns(db);
  ensureDeviceSourceColumns(db);
  backfillUserHubIds(db);
  backfillLegacyWeatherDevices(db);
  backfillHomeSensorDevices(db);
  db.exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_users_hub_id ON users(hub_id)");
}

function seedDemo(db: Database.Database) {
  const usersCount = db.prepare("SELECT COUNT(*) AS count FROM users").get() as { count: number };
  if (usersCount.count > 0) {
    return;
  }

  const userId = randomUUID();
  const now = new Date().toISOString();
  const hubId = buildHubId(userId);

  db.prepare(
    "INSERT INTO users (id, name, email, hub_id, password_hash, created_at) VALUES (?, ?, ?, ?, ?, ?)"
  ).run(userId, "Матвей Саблуков", "matvey@example.com", hubId, bcrypt.hashSync("password123", 10), now);

  seedHomeForUser(db, userId);
}

export function seedHomeForUser(db: Database.Database, userId: string) {
  const now = new Date().toISOString();
  const devices = [
    ["living-light", "Лампа в гостиной", "LIGHT_SENSOR", "Освещение", "Гостиная", 1, 1, null, "manual", null],
    ["bedroom-climate", "Кондиционер", "CLIMATE_SENSOR", "Климат", "Спальня", 1, 0, "24°C", "manual", null],
    ["kitchen-temp", "Датчик температуры", "TEMPERATURE_SENSOR", "Датчики", "Кухня", 1, 1, "26°C", "home_sensor", "temperature"],
    ["office-plug", "Умная розетка", "SWITCH_SENSOR", "Розетки", "Кабинет", 0, 0, null, "manual", null],
    ["bedroom-humidity", "Увлажнитель", "CLIMATE_SENSOR", "Климат", "Спальня", 1, 1, "45%", "manual", null],
    ["hall-motion", "Датчик движения", "MOTION_SENSOR", "Безопасность", "Коридор", 1, 1, null, "home_sensor", "motion"]
  ];

  const deviceInsert = db.prepare(`
    INSERT OR IGNORE INTO devices
    (id, user_id, name, type, category, room, online, enabled, metric, source_kind, source_metric, last_seen, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  for (const device of devices) {
    deviceInsert.run(device[0], userId, device[1], device[2], device[3], device[4], device[5], device[6], device[7], device[8], device[9], now, now);
  }

  const scenarioInsert = db.prepare(`
    INSERT OR IGNORE INTO scenarios
    (id, user_id, title, metric, operator, value, unit, target_device_id, target_device_name, command, active, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  scenarioInsert.run("auto-cooling", userId, "Автоохлаждение", "Температура", ">", 25, "°C", "bedroom-climate", "Кондиционер", "Включить", 1, now);
  scenarioInsert.run("night-mode", userId, "Ночной режим", "Выключатель", "=", 1, null, "living-light", "Лампа в гостиной", "Выключить", 0, now);
  scenarioInsert.run("cozy-evening", userId, "Уютный вечер", "Движение", "=", 1, null, "living-light", "Лампа в гостиной", "Включить", 1, now);

  const notificationInsert = db.prepare(`
    INSERT OR IGNORE INTO notifications (id, user_id, title, type, unread, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  notificationInsert.run(randomUUID(), userId, "Температура выше 25°C в гостиной", "temperature", 1, now);
  notificationInsert.run(randomUUID(), userId, "Движение в коридоре", "motion", 1, now);
  notificationInsert.run(randomUUID(), userId, "Свет на кухне включен", "device", 0, now);

  const telemetryInsert = db.prepare(`
    INSERT INTO telemetry_points (id, user_id, device_id, kind, value, unit, source, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const hours = [23, 21, 18, 15, 12, 9, 6, 3];
  const values = [22, 21, 20, 23, 26, 27, 25, 23];
  hours.forEach((hoursAgo, index) => {
    const date = new Date(Date.now() - hoursAgo * 60 * 60 * 1000).toISOString();
    telemetryInsert.run(randomUUID(), userId, "kitchen-temp", "temperature", values[index], "°C", "home_sensor", date);
  });
}

function ensureUsersHubIdColumn(db: Database.Database) {
  const columns = db.prepare("PRAGMA table_info(users)").all() as Array<{ name: string }>;
  if (!columns.some((column) => column.name === "hub_id")) {
    db.exec("ALTER TABLE users ADD COLUMN hub_id TEXT");
  }
}

function backfillUserHubIds(db: Database.Database) {
  const users = db.prepare("SELECT id FROM users WHERE hub_id IS NULL OR hub_id = ''").all() as Array<{ id: string }>;
  const statement = db.prepare("UPDATE users SET hub_id = ? WHERE id = ?");

  for (const user of users) {
    statement.run(buildHubId(user.id), user.id);
  }
}

function ensureTelemetryPipelineColumns(db: Database.Database) {
  const columns = db.prepare("PRAGMA table_info(telemetry_points)").all() as Array<{ name: string }>;
  const columnNames = new Set(columns.map((column) => column.name));

  if (!columnNames.has("source")) {
    db.exec("ALTER TABLE telemetry_points ADD COLUMN source TEXT NOT NULL DEFAULT 'manual'");
  }
  if (!columnNames.has("external_observed_at")) {
    db.exec("ALTER TABLE telemetry_points ADD COLUMN external_observed_at TEXT");
  }
  if (!columnNames.has("external_event_id")) {
    db.exec("ALTER TABLE telemetry_points ADD COLUMN external_event_id TEXT");
  }
}

function ensureDeviceSourceColumns(db: Database.Database) {
  const columns = db.prepare("PRAGMA table_info(devices)").all() as Array<{ name: string }>;
  const columnNames = new Set(columns.map((column) => column.name));

  if (!columnNames.has("source_kind")) {
    db.exec("ALTER TABLE devices ADD COLUMN source_kind TEXT NOT NULL DEFAULT 'manual'");
  }
  if (!columnNames.has("source_metric")) {
    db.exec("ALTER TABLE devices ADD COLUMN source_metric TEXT");
  }
  if (!columnNames.has("is_system")) {
    db.exec("ALTER TABLE devices ADD COLUMN is_system INTEGER NOT NULL DEFAULT 0");
  }
}

function backfillHomeSensorDevices(db: Database.Database) {
  db.exec(`
    UPDATE devices
    SET source_kind = 'home_sensor',
        source_metric = 'temperature'
    WHERE source_kind = 'manual'
      AND is_system = 0
      AND type = 'TEMPERATURE_SENSOR'
      AND source_metric IS NULL;

    UPDATE devices
    SET source_kind = 'home_sensor',
        source_metric = 'motion'
    WHERE source_kind = 'manual'
      AND is_system = 0
      AND type = 'MOTION_SENSOR'
      AND source_metric IS NULL;
  `);
}

function ensureScenarioSourceColumns(db: Database.Database) {
  const columns = db.prepare("PRAGMA table_info(scenarios)").all() as Array<{ name: string }>;
  const columnNames = new Set(columns.map((column) => column.name));
  const additions = [
    ["trigger_type", "TEXT NOT NULL DEFAULT 'automatic'"],
    ["automation_source", "TEXT NOT NULL DEFAULT 'sensor'"],
    ["favorite", "INTEGER NOT NULL DEFAULT 0"],
    ["source_device_id", "TEXT"],
    ["source_device_name", "TEXT"],
    ["source_metric", "TEXT"],
    ["schedule_time", "TEXT"],
    ["schedule_timezone", "TEXT"],
    ["last_schedule_run_at", "TEXT"],
    ["last_evaluation_status", "TEXT"],
    ["last_actual_value", "REAL"],
    ["last_actual_unit", "TEXT"],
    ["last_evaluation_reason", "TEXT"],
    ["last_evaluated_at", "TEXT"],
    ["last_applied", "INTEGER NOT NULL DEFAULT 0"]
  ] as const;

  for (const [column, definition] of additions) {
    if (!columnNames.has(column)) {
      db.exec(`ALTER TABLE scenarios ADD COLUMN ${column} ${definition}`);
    }
  }
}

function backfillLegacyWeatherDevices(db: Database.Database) {
  db.exec(`
    UPDATE devices
    SET source_kind = 'open_meteo',
        is_system = 1
    WHERE id LIKE 'weather-outdoor-%'
  `);
}
