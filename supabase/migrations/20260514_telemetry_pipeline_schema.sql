-- Supabase schema migration for the public-API/Kafka telemetry pipeline.
-- Apply this in the Supabase SQL Editor before starting the BFF/runtime services.

BEGIN;

CREATE SCHEMA IF NOT EXISTS analyzer;

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS hub_id text;

UPDATE public.users
SET hub_id = 'home-' || id
WHERE hub_id IS NULL OR hub_id = '';

ALTER TABLE public.users
  ALTER COLUMN hub_id SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_hub_id
  ON public.users (hub_id);

CREATE TABLE IF NOT EXISTS public.home_locations (
  user_id text PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  hub_id text UNIQUE NOT NULL REFERENCES public.users(hub_id) ON DELETE CASCADE,
  latitude double precision NOT NULL,
  longitude double precision NOT NULL,
  accuracy_meters double precision,
  timezone text NOT NULL DEFAULT 'Europe/Moscow',
  label text,
  source text NOT NULL DEFAULT 'browser',
  updated_at text NOT NULL
);

ALTER TABLE public.telemetry_points
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS external_observed_at text,
  ADD COLUMN IF NOT EXISTS external_event_id text;

CREATE UNIQUE INDEX IF NOT EXISTS idx_telemetry_external_event_id
  ON public.telemetry_points (external_event_id);

CREATE INDEX IF NOT EXISTS idx_devices_user
  ON public.devices (user_id);

CREATE INDEX IF NOT EXISTS idx_scenarios_user
  ON public.scenarios (user_id);

CREATE INDEX IF NOT EXISTS idx_notifications_user
  ON public.notifications (user_id);

CREATE INDEX IF NOT EXISTS idx_telemetry_user_device_created
  ON public.telemetry_points (user_id, device_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_home_locations_hub_id
  ON public.home_locations (hub_id);

ALTER TABLE public.devices
  DROP CONSTRAINT IF EXISTS devices_user_id_fkey,
  ADD CONSTRAINT devices_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

ALTER TABLE public.notifications
  DROP CONSTRAINT IF EXISTS notifications_user_id_fkey,
  ADD CONSTRAINT notifications_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

ALTER TABLE public.password_reset_tokens
  DROP CONSTRAINT IF EXISTS password_reset_tokens_user_id_fkey,
  ADD CONSTRAINT password_reset_tokens_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

ALTER TABLE public.scenarios
  DROP CONSTRAINT IF EXISTS scenarios_user_id_fkey,
  ADD CONSTRAINT scenarios_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

ALTER TABLE public.scenarios
  DROP CONSTRAINT IF EXISTS scenarios_target_device_id_fkey,
  ADD CONSTRAINT scenarios_target_device_id_fkey
    FOREIGN KEY (target_device_id) REFERENCES public.devices(id) ON DELETE SET NULL;

ALTER TABLE public.subscriptions
  DROP CONSTRAINT IF EXISTS subscriptions_user_id_fkey,
  ADD CONSTRAINT subscriptions_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

ALTER TABLE public.telegram_integrations
  DROP CONSTRAINT IF EXISTS telegram_integrations_user_id_fkey,
  ADD CONSTRAINT telegram_integrations_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

ALTER TABLE public.telemetry_points
  DROP CONSTRAINT IF EXISTS telemetry_points_user_id_fkey,
  ADD CONSTRAINT telemetry_points_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

ALTER TABLE public.telemetry_points
  DROP CONSTRAINT IF EXISTS telemetry_points_device_id_fkey,
  ADD CONSTRAINT telemetry_points_device_id_fkey
    FOREIGN KEY (device_id) REFERENCES public.devices(id) ON DELETE CASCADE;

COMMIT;
