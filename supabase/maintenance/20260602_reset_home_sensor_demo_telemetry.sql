-- Run once after deploying the smoother home sensor model.
-- Outdoor Open-Meteo telemetry and manually added points are intentionally preserved.

BEGIN;

DELETE FROM public.telemetry_points
WHERE source = 'home_sensor';

UPDATE public.devices
SET metric = NULL
WHERE source_kind = 'home_sensor';

COMMIT;
