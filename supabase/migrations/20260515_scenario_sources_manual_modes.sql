-- Supabase schema migration for explicit scenario sources and manual modes.

BEGIN;

ALTER TABLE public.devices
  ADD COLUMN IF NOT EXISTS source_kind text NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS source_metric text,
  ADD COLUMN IF NOT EXISTS is_system integer NOT NULL DEFAULT 0;

UPDATE public.devices
SET source_kind = 'open_meteo',
    is_system = 1
WHERE id LIKE 'weather-outdoor-%';

ALTER TABLE public.scenarios
  ADD COLUMN IF NOT EXISTS trigger_type text NOT NULL DEFAULT 'automatic',
  ADD COLUMN IF NOT EXISTS favorite integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS source_device_id text,
  ADD COLUMN IF NOT EXISTS source_device_name text,
  ADD COLUMN IF NOT EXISTS source_metric text,
  ADD COLUMN IF NOT EXISTS last_evaluation_status text,
  ADD COLUMN IF NOT EXISTS last_actual_value real,
  ADD COLUMN IF NOT EXISTS last_actual_unit text,
  ADD COLUMN IF NOT EXISTS last_evaluation_reason text,
  ADD COLUMN IF NOT EXISTS last_evaluated_at text,
  ADD COLUMN IF NOT EXISTS last_applied integer NOT NULL DEFAULT 0;

ALTER TABLE public.scenarios
  DROP CONSTRAINT IF EXISTS scenarios_source_device_id_fkey,
  ADD CONSTRAINT scenarios_source_device_id_fkey
    FOREIGN KEY (source_device_id) REFERENCES public.devices(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS public.scenario_actions (
  id text NOT NULL,
  user_id text NOT NULL,
  scenario_id text NOT NULL,
  target_device_id text,
  target_device_name text NOT NULL,
  command text NOT NULL,
  order_index integer NOT NULL DEFAULT 0,
  created_at text NOT NULL,
  CONSTRAINT scenario_actions_pkey PRIMARY KEY (id),
  CONSTRAINT scenario_actions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE,
  CONSTRAINT scenario_actions_scenario_id_fkey FOREIGN KEY (scenario_id) REFERENCES public.scenarios(id) ON DELETE CASCADE,
  CONSTRAINT scenario_actions_target_device_id_fkey FOREIGN KEY (target_device_id) REFERENCES public.devices(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_scenario_actions_scenario
  ON public.scenario_actions (scenario_id, order_index);

COMMIT;
