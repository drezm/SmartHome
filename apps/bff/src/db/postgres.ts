import { Pool } from "pg";
import { env } from "../config/env.js";

let pool: Pool | null = null;
let schemaVerified = false;

export function getPostgresPool() {
  if (!env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required for Postgres storage");
  }

  if (!pool) {
    pool = new Pool({
      connectionString: env.DATABASE_URL,
      ssl: env.DATABASE_SSL ? { rejectUnauthorized: false } : undefined,
      max: env.DATABASE_POOL_MAX
    });
    pool.on("error", (error) => {
      console.error("Postgres idle client error", error);
    });
  }

  return pool;
}

export async function verifySupabaseSchema(db = getPostgresPool()) {
  if (schemaVerified) {
    return;
  }

  const missing = [
    ...(await findMissingColumns(db)),
    ...(await findMissingIndexes(db)),
    ...(await findInvalidForeignKeys(db))
  ];

  if (missing.length > 0) {
    throw new Error(
      [
        "Supabase schema is not ready for the telemetry pipeline.",
        "Apply supabase/migrations/20260514_telemetry_pipeline_schema.sql, supabase/migrations/20260515_scenario_sources_manual_modes.sql, supabase/migrations/20260516_home_sensors.sql and supabase/migrations/20260517_schedule_reports.sql in the Supabase SQL Editor.",
        `Missing or invalid objects: ${missing.join(", ")}`
      ].join(" ")
    );
  }

  schemaVerified = true;
}

async function findMissingColumns(db: Pool) {
  const requiredColumns: Record<string, string[]> = {
    users: ["id", "name", "email", "hub_id", "password_hash", "created_at"],
    devices: ["id", "user_id", "name", "type", "category", "room", "online", "enabled", "metric", "source_kind", "source_metric", "is_system", "last_seen", "created_at"],
    scenarios: [
      "id",
      "user_id",
      "title",
      "trigger_type",
      "automation_source",
      "favorite",
      "metric",
      "operator",
      "value",
      "unit",
      "source_device_id",
      "source_device_name",
      "source_metric",
      "schedule_time",
      "schedule_timezone",
      "last_schedule_run_at",
      "target_device_id",
      "target_device_name",
      "command",
      "active",
      "last_evaluation_status",
      "last_actual_value",
      "last_actual_unit",
      "last_evaluation_reason",
      "last_evaluated_at",
      "last_applied",
      "created_at"
    ],
    scenario_actions: ["id", "user_id", "scenario_id", "target_device_id", "target_device_name", "command", "order_index", "created_at"],
    notifications: ["id", "user_id", "title", "type", "unread", "created_at"],
    telemetry_points: ["id", "user_id", "device_id", "kind", "value", "unit", "created_at", "source", "external_observed_at", "external_event_id"],
    subscriptions: ["user_id", "plan", "status", "started_at", "expires_at", "cancelled_at", "payment_mock_last4", "payment_email", "created_at", "updated_at"],
    telegram_integrations: ["user_id", "bot_token_encrypted", "chat_id", "created_at", "updated_at"],
    password_reset_tokens: ["id", "user_id", "token_hash", "expires_at", "consumed_at", "created_at"],
    home_locations: ["user_id", "hub_id", "latitude", "longitude", "accuracy_meters", "timezone", "label", "source", "updated_at"]
  };

  const tableNames = Object.keys(requiredColumns);
  const result = await db.query<{ table_name: string; column_name: string }>(
    `SELECT table_name, column_name
     FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = ANY($1::text[])`,
    [tableNames]
  );
  const actual = new Map<string, Set<string>>();

  for (const row of result.rows) {
    const table = actual.get(row.table_name) ?? new Set<string>();
    table.add(row.column_name);
    actual.set(row.table_name, table);
  }

  return Object.entries(requiredColumns).flatMap(([table, columns]) =>
    columns
      .filter((column) => !actual.get(table)?.has(column))
      .map((column) => `public.${table}.${column}`)
  );
}

async function findMissingIndexes(db: Pool) {
  const requiredIndexes = [
    "idx_users_hub_id",
    "idx_devices_user",
    "idx_scenarios_user",
    "idx_notifications_user",
    "idx_scenario_actions_scenario",
    "idx_telemetry_user_device_created",
    "idx_home_locations_hub_id",
    "idx_telemetry_external_event_id"
  ];
  const result = await db.query<{ indexname: string }>(
    "SELECT indexname FROM pg_indexes WHERE schemaname = 'public' AND indexname = ANY($1::text[])",
    [requiredIndexes]
  );
  const actual = new Set(result.rows.map((row) => row.indexname));

  return requiredIndexes
    .filter((index) => !actual.has(index))
    .map((index) => `index public.${index}`);
}

async function findInvalidForeignKeys(db: Pool) {
  const expected = [
    { table: "devices", column: "user_id", targetTable: "users", targetColumn: "id", deleteRule: "CASCADE" },
    { table: "notifications", column: "user_id", targetTable: "users", targetColumn: "id", deleteRule: "CASCADE" },
    { table: "password_reset_tokens", column: "user_id", targetTable: "users", targetColumn: "id", deleteRule: "CASCADE" },
    { table: "scenarios", column: "user_id", targetTable: "users", targetColumn: "id", deleteRule: "CASCADE" },
    { table: "scenarios", column: "source_device_id", targetTable: "devices", targetColumn: "id", deleteRule: "SET NULL" },
    { table: "scenarios", column: "target_device_id", targetTable: "devices", targetColumn: "id", deleteRule: "SET NULL" },
    { table: "scenario_actions", column: "user_id", targetTable: "users", targetColumn: "id", deleteRule: "CASCADE" },
    { table: "scenario_actions", column: "scenario_id", targetTable: "scenarios", targetColumn: "id", deleteRule: "CASCADE" },
    { table: "scenario_actions", column: "target_device_id", targetTable: "devices", targetColumn: "id", deleteRule: "SET NULL" },
    { table: "subscriptions", column: "user_id", targetTable: "users", targetColumn: "id", deleteRule: "CASCADE" },
    { table: "telegram_integrations", column: "user_id", targetTable: "users", targetColumn: "id", deleteRule: "CASCADE" },
    { table: "telemetry_points", column: "user_id", targetTable: "users", targetColumn: "id", deleteRule: "CASCADE" },
    { table: "telemetry_points", column: "device_id", targetTable: "devices", targetColumn: "id", deleteRule: "CASCADE" },
    { table: "home_locations", column: "user_id", targetTable: "users", targetColumn: "id", deleteRule: "CASCADE" },
    { table: "home_locations", column: "hub_id", targetTable: "users", targetColumn: "hub_id", deleteRule: "CASCADE" }
  ];

  const result = await db.query<{
    table_name: string;
    column_name: string;
    foreign_table_name: string;
    foreign_column_name: string;
    delete_rule: string;
  }>(`
    SELECT
      kcu.table_name,
      kcu.column_name,
      ccu.table_name AS foreign_table_name,
      ccu.column_name AS foreign_column_name,
      rc.delete_rule
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name
      AND tc.table_schema = kcu.table_schema
    JOIN information_schema.constraint_column_usage ccu
      ON ccu.constraint_name = tc.constraint_name
      AND ccu.constraint_schema = tc.constraint_schema
    JOIN information_schema.referential_constraints rc
      ON rc.constraint_name = tc.constraint_name
      AND rc.constraint_schema = tc.constraint_schema
    WHERE tc.constraint_type = 'FOREIGN KEY'
      AND tc.table_schema = 'public'
  `);

  return expected
    .filter((item) =>
      !result.rows.some(
        (row) =>
          row.table_name === item.table &&
          row.column_name === item.column &&
          row.foreign_table_name === item.targetTable &&
          row.foreign_column_name === item.targetColumn &&
          row.delete_rule === item.deleteRule
      )
    )
    .map((item) => `foreign key public.${item.table}.${item.column} -> public.${item.targetTable}.${item.targetColumn} ON DELETE ${item.deleteRule}`);
}
