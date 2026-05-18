-- Add explicit automatic scenario sources and daily schedule fields.

BEGIN;

ALTER TABLE public.scenarios
  ADD COLUMN IF NOT EXISTS automation_source text NOT NULL DEFAULT 'sensor',
  ADD COLUMN IF NOT EXISTS schedule_time text,
  ADD COLUMN IF NOT EXISTS schedule_timezone text,
  ADD COLUMN IF NOT EXISTS last_schedule_run_at text;

UPDATE public.scenarios
SET automation_source = 'sensor'
WHERE automation_source IS NULL
   OR automation_source = '';

COMMIT;
