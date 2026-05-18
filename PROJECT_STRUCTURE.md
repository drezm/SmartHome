# Project Structure

Актуальная структура после перехода на runtime `web + BFF + Supabase`.

## Корень

- `.env.example` - пример переменных окружения для Supabase, email, weather API и frontend API URL.
- `docker-compose.yml` - default runtime поднимает только `web` и `bff`; Kafka оставлена в profile `kafka`.
- `package.json` - npm workspaces для `apps/web` и `apps/bff`.
- `supabase/migrations/20260514_telemetry_pipeline_schema.sql` - SQL-миграция для `hub_id`, `home_locations`, telemetry source fields, индексов и FK.
- `supabase/migrations/20260515_scenario_sources_manual_modes.sql` - SQL-миграция для explicit scenario sources, manual modes и `scenario_actions`.
- `backups/` - SQL-бэкапы и seed-файлы для ручного восстановления данных.
- `docker/backend.Dockerfile` - legacy Dockerfile для Java backend, не используется в default runtime.

## Runtime Flow

```text
Browser -> Web -> BFF -> Supabase
                 |
                 -> Open-Meteo -> telemetry_points
```

Frontend не ходит напрямую в Supabase или Open-Meteo. Все app-данные и telemetry persistence живут в Supabase.

Kafka можно поднять отдельно для будущего pipeline:

```bash
docker compose --profile kafka up -d kafka kafka-init-topics
```

## `apps/bff`

Express + TypeScript BFF.

- `src/app.ts` - собирает Express app, health endpoint, routes и repositories.
- `src/server.ts` - production entrypoint, требует Supabase `DATABASE_URL`.
- `src/config/env.ts` - env validation через Zod.
- `src/db/postgres.ts` - Supabase pool и startup schema check.
- `src/db/database.ts` - SQLite storage только для tests/dev helpers.
- `src/domain/types.ts` - общие backend-типы: users, devices, scenarios, telemetry, location, weather.
- `src/repositories/` - Supabase/Postgres и SQLite реализации storage contracts.
- `src/routes/` - REST endpoints для auth, dashboard, devices, scenarios, telemetry, location, subscription, Telegram.
- `src/services/homeService.ts` - основная бизнес-логика для устройств, автоматических сценариев, ручных режимов, dashboard и Telegram.
- `src/services/weatherService.ts` - Open-Meteo integration, weather cache и запись public API telemetry по отдельным системным сенсорам.
- `src/services/newsService.ts` - RSS IT news для free-пользователей.
- `src/test/` - Vitest/Supertest tests.

## Weather Persistence

- Локация дома хранится в `home_locations`.
- Dashboard вызывает `WeatherService`, если локация задана.
- BFF создает отдельные системные Open-Meteo-датчики для температуры, влажности, осадков и ветра; наружную освещенность пользователь может добавить отдельно.
- Open-Meteo current weather сохраняется в `telemetry_points` с `source = public_api`.
- `external_event_id` имеет формат `open-meteo:${userId}:${observedAt}:${kind}` и защищает от дублей.
- Кэш управляется `WEATHER_CACHE_TTL_MS`.

## `apps/web`

React + Vite frontend.

- `src/app/` - providers, routes, global styles.
- `src/widgets/app-shell/` - основной shell, sidebar, header.
- `src/pages/auth/` - login/register/reset pages.
- `src/pages/dashboard/` - dashboard, favorite manual modes, charts, current scenario и weather card.
- `src/pages/devices/` - список и создание устройств.
- `src/pages/scenarios/` - список и создание сценариев.
- `src/pages/analytics/` - premium analytics и PDF reports.
- `src/pages/notifications/` - уведомления.
- `src/pages/profile/` - профиль, подписка, безопасность, Telegram integration.
- `src/pages/settings/` - API endpoints и домашняя локация через browser geolocation.
- `src/shared/api/` - typed API client и query keys.
- `src/shared/ui/` - общие UI primitives.

## Default Ports

- Web: `http://localhost:5173`
- BFF: `http://localhost:3000`
- Health: `http://localhost:3000/api/health`

## Checks

```bash
npm run typecheck -w @smart-home/bff
npm run typecheck -w @smart-home/web
npm test -w @smart-home/bff
npm test -w @smart-home/web
docker compose config --quiet
```
