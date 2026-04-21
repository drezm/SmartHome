# Smart Flow Home

Рабочий monorepo для дипломного интерфейса умного дома: React frontend, REST BFF и подключение к telemetry backend через gRPC collector. Папка `commerce` из исходного backend не используется.

## Быстрый запуск

```bash
docker compose up --build
```

После старта:

- UI: http://localhost:5173
- BFF health: http://localhost:3000/api/health
- gRPC collector: `collector:9090` внутри compose, `localhost:9090` с хоста

Для входа можно зарегистрировать нового пользователя. Также BFF создает demo-аккаунт:

- email: `matvey@example.com`
- password: `password123`

## Локальный запуск без Docker

```bash
npm install
npm run dev
```

По умолчанию frontend ждет BFF на `http://localhost:3000/api`, а gRPC-синхронизация с collector отключена. Для локального подключения к запущенному collector задайте `COLLECTOR_GRPC_URL=localhost:9090`.

## Supabase/Postgres

1. Выполните SQL из `backups/smart-home-supabase-seed-2026-04-21.sql` в Supabase SQL Editor, если нужна копия текущей локальной базы.
2. Создайте локальный `.env` на основе `.env.example`.
3. Вставьте Supabase connection string в `DATABASE_URL`.
4. Оставьте `DATABASE_SSL=true` для Supabase pooler.
5. Перезапустите BFF или `docker compose up --build`.

Если `DATABASE_URL` пустой, BFF продолжит использовать локальный SQLite-файл из `DB_PATH`.

## Структура

- `apps/web` - React/Vite frontend по FSD: `app`, `pages`, `widgets`, `features`, `entities`, `shared`.
- `apps/bff` - Express BFF: `routes`, `services`, `repositories`, `adapters/grpc`, `db`, `domain`, `config`.
- `docker/backend.Dockerfile` - сборка только `infra` и `telemetry` из backend GitHub, без `commerce`.

## Что делает BFF

- Хранит пользователей, устройства, сценарии, уведомления и телеметрию в SQLite по умолчанию или в Supabase/Postgres через `DATABASE_URL`.
- Выдает JWT для локальной авторизации.
- Дает frontend REST API.
- При создании/удалении устройств и сценариев отправляет hub events в telemetry collector.
- При переключении устройств и отправке телеметрии отправляет sensor events в telemetry collector.
- Если collector недоступен, UI продолжает работать, а BFF создает уведомление о проблеме синхронизации.
