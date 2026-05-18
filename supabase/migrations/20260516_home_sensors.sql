-- Safe backfill for existing unambiguous in-home sensors.

BEGIN;

UPDATE public.devices
SET source_kind = 'home_sensor',
    source_metric = 'temperature'
WHERE source_kind = 'manual'
  AND is_system = 0
  AND type = 'TEMPERATURE_SENSOR'
  AND source_metric IS NULL;

UPDATE public.devices
SET source_kind = 'home_sensor',
    source_metric = 'motion'
WHERE source_kind = 'manual'
  AND is_system = 0
  AND type = 'MOTION_SENSOR'
  AND source_metric IS NULL;

COMMIT;
