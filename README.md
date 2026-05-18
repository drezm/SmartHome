# Smart Flow Home

Рабочий monorepo для дипломного интерфейса умного дома: React frontend, REST BFF и Supabase/Postgres как единственная runtime-база для app-данных и телеметрии.

## Быстрый запуск

Перед запуском создайте `.env` на основе `.env.example`, укажите Supabase `DATABASE_URL` и примените SQL из `supabase/migrations/20260514_telemetry_pipeline_schema.sql`, затем `supabase/migrations/20260515_scenario_sources_manual_modes.sql` в Supabase SQL Editor.

```bash
docker compose up --build
```

После старта:

- UI: http://localhost:5173
- BFF health: http://localhost:3000/api/health

Для входа можно зарегистрировать нового пользователя. Также BFF создает demo-аккаунт:

- email: `matvey@example.com`
- password: `password123`

## Локальный запуск без Docker

```bash
npm install
npm run dev
```

По умолчанию frontend ждет BFF на `http://localhost:3000/api`, а BFF для runtime-старта требует Supabase `DATABASE_URL`.

Kafka оставлена как optional future infrastructure:

```bash
docker compose --profile kafka up -d kafka kafka-init-topics
```

## Supabase

1. Выполните SQL из `backups/smart-home-supabase-seed-2026-04-21.sql` в Supabase SQL Editor, если нужна копия текущей локальной базы.
2. Выполните SQL из `backups/smart-home-supabase-premium-migration-2026-04-22.sql`, чтобы добавить таблицы подписки, Telegram и восстановления пароля.
3. Выполните SQL из `supabase/migrations/20260514_telemetry_pipeline_schema.sql`, чтобы добавить `hub_id`, `home_locations`, поля источника телеметрии и корректные FK.
4. Выполните SQL из `supabase/migrations/20260515_scenario_sources_manual_modes.sql`, чтобы добавить источники устройств, manual modes и `scenario_actions`.
5. Создайте локальный `.env` на основе `.env.example`.
6. Вставьте Supabase connection string в `DATABASE_URL`.
7. Оставьте `DATABASE_SSL=true` для Supabase pooler.
8. Перезапустите BFF или `docker compose up --build`.

Если `DATABASE_URL` пустой или схема Supabase не готова, runtime BFF не стартует.

## Погода

- Домашняя локация хранится в `home_locations` и задается через `/api/location/browser`.
- Dashboard на стороне BFF берет текущую погоду из Open-Meteo по координатам, кэширует ее на `WEATHER_CACHE_TTL_MS` и сохраняет точки в `telemetry_points`.
- Для погодных данных BFF создает отдельные системные Open-Meteo-датчики: температура, влажность, осадки и ветер; датчик наружной освещенности можно добавить вручную.
- Автоматические сценарии читают конкретный `source device + metric`, а избранные ручные режимы запускаются пользователем с дашборда.
- Frontend не ходит напрямую в Supabase или Open-Meteo.

## Почта, Telegram и подписка

- Подписка работает как mock-оплата: после формы оплаты пользователь получает Premium на 30 дней за `150 ₽/мес`.
- Telegram доступен Premium-пользователям. Bot token шифруется через `SECRETS_ENCRYPTION_KEY`; для production задайте свой длинный ключ.
- Восстановление пароля отправляет 6-значный код на email. Основной вариант - Resend Email API; SMTP оставлен как fallback.
- Новости умного дома берутся из RSS-лент `NEWS_RSS_FEEDS`; ключи внешних API не нужны.
- Новые регистрации стартуют с пустым домом; demo-данные остаются у аккаунта `matvey@example.com`.

### Быстрая настройка email-кодов через Resend

Такой вариант не требует пароля от Gmail/Yandex/Mail.ru/iCloud. Нужен один API key проекта в Resend и email отправителя.

```env
EMAIL_PROVIDER=resend
RESEND_API_KEY=re_xxxxxxxxx
EMAIL_FROM="SmartHome <onboarding@resend.dev>"
APP_PUBLIC_URL=http://localhost:5173
```

Для локального демо без реальной отправки писем:

```env
EMAIL_PROVIDER=dev
```

В dev-режиме BFF вернет код в ответе API и выведет его в консоль.

SMTP fallback остается доступен:

```env
EMAIL_PROVIDER=smtp
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=app-specific-password
SMTP_FROM="SmartHome <your-email@gmail.com>"
```

Локальный `.env` можно положить в корень проекта или в `apps/bff`. После изменения перезапустите BFF: `npm run dev:bff`.

## Структура

- `apps/web` - React/Vite frontend по FSD: `app`, `pages`, `widgets`, `features`, `entities`, `shared`.
- `apps/bff` - Express BFF: `routes`, `services`, `repositories`, `db`, `domain`, `config`.
- `docker/backend.Dockerfile` - legacy-сборка Java backend, не используется в default runtime.

## Что делает BFF

- Хранит пользователей, устройства, сценарии, уведомления, локацию дома и телеметрию в Supabase/Postgres через `DATABASE_URL`.
- Выдает JWT для локальной авторизации.
- Дает frontend REST API.
- Проверяет Supabase-схему при старте и просит применить SQL-миграцию, если не хватает таблиц, колонок, индексов или FK.
- Не запускает фоновую генерацию sensor data в runtime.
- Получает погодную телеметрию через Open-Meteo по домашней локации и сохраняет ее в Supabase.
- CRUD устройств/сценариев и ручные режимы работают через Supabase без gRPC-синхронизации.
