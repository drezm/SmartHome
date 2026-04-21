import Database from "better-sqlite3";
import bcrypt from "bcryptjs";
import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { env } from "../config/env.js";

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
      target_device_id TEXT,
      target_device_name TEXT NOT NULL,
      command TEXT NOT NULL,
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
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
      created_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (device_id) REFERENCES devices(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_devices_user ON devices(user_id);
    CREATE INDEX IF NOT EXISTS idx_scenarios_user ON scenarios(user_id);
    CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
    CREATE INDEX IF NOT EXISTS idx_telemetry_user_device ON telemetry_points(user_id, device_id);
  `);
}

function seedDemo(db: Database.Database) {
  const usersCount = db.prepare("SELECT COUNT(*) AS count FROM users").get() as { count: number };
  if (usersCount.count > 0) {
    return;
  }

  const userId = randomUUID();
  const now = new Date().toISOString();

  db.prepare(
    "INSERT INTO users (id, name, email, password_hash, created_at) VALUES (?, ?, ?, ?, ?)"
  ).run(userId, "Матвей Саблуков", "matvey@example.com", bcrypt.hashSync("password123", 10), now);

  seedHomeForUser(db, userId);
}

export function seedHomeForUser(db: Database.Database, userId: string) {
  const now = new Date().toISOString();
  const devices = [
    ["living-light", "Лампа в гостиной", "LIGHT_SENSOR", "Освещение", "Гостиная", 1, 1, null],
    ["bedroom-climate", "Кондиционер", "CLIMATE_SENSOR", "Климат", "Спальня", 1, 0, "24°C"],
    ["kitchen-temp", "Датчик температуры", "TEMPERATURE_SENSOR", "Датчики", "Кухня", 1, 1, "26°C"],
    ["office-plug", "Умная розетка", "SWITCH_SENSOR", "Розетки", "Кабинет", 0, 0, null],
    ["bedroom-humidity", "Увлажнитель", "CLIMATE_SENSOR", "Климат", "Спальня", 1, 1, "45%"],
    ["hall-motion", "Датчик движения", "MOTION_SENSOR", "Безопасность", "Коридор", 1, 1, null]
  ];

  const deviceInsert = db.prepare(`
    INSERT OR IGNORE INTO devices
    (id, user_id, name, type, category, room, online, enabled, metric, last_seen, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  for (const device of devices) {
    deviceInsert.run(device[0], userId, device[1], device[2], device[3], device[4], device[5], device[6], device[7], now, now);
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
    INSERT INTO telemetry_points (id, user_id, device_id, kind, value, unit, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  const hours = [23, 21, 18, 15, 12, 9, 6, 3];
  const values = [22, 21, 20, 23, 26, 27, 25, 23];
  hours.forEach((hoursAgo, index) => {
    const date = new Date(Date.now() - hoursAgo * 60 * 60 * 1000).toISOString();
    telemetryInsert.run(randomUUID(), userId, "kitchen-temp", "temperature", values[index], "°C", date);
  });
}
