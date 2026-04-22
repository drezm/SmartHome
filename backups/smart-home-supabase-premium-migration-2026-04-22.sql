-- Smart Flow Home premium features migration for Supabase/Postgres
-- Run this after backups/smart-home-supabase-seed-2026-04-21.sql
-- Adds subscription, Telegram integration and password reset storage.

SET client_encoding = 'UTF8';
SET search_path = public;

BEGIN;

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

CREATE INDEX IF NOT EXISTS idx_password_reset_token_hash ON password_reset_tokens(token_hash);

COMMIT;
