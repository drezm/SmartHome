# Smart Flow Home

Рабочий monorepo для дипломного интерфейса умного дома: React frontend, REST BFF и Supabase/Postgres как единственная runtime-база для app-данных и телеметрии.

## Быстрый запуск

Перед запуском создайте `.env` на основе `.env.example`, укажите Supabase `DATABASE_URL` и последовательно примените SQL из `supabase/migrations` в Supabase SQL Editor.

```bash
docker compose up --build
```

После старта:

- UI: http://localhost:5173
- BFF health: http://localhost:3000/api/health

Для входа можно зарегистрировать нового пользователя. Также BFF создает demo-аккаунт:

- email: `matvey@example.com`
- password: `password123`

Новые пароли при регистрации и восстановлении должны содержать минимум 8 символов и любые 3 группы из 4: строчные буквы, заглавные буквы, цифры, спецсимволы.

Для production-деплоя через reverse proxy можно собрать frontend с относительным API:

```env
APP_DOMAIN=vm1312229.cloud.nuxt.network
APP_PUBLIC_URL=https://vm1312229.cloud.nuxt.network
CORS_ORIGIN=https://vm1312229.cloud.nuxt.network
VITE_API_URL=/api
```

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

Для просмотра локальных сообщений Kafka поднимите UI:

```bash
docker compose --profile kafka up -d kafka kafka-init-topics kafka-ui
```

- Kafka UI: http://localhost:8080
- Для публикации свежих Open-Meteo событий из BFF включите `KAFKA_ENABLED=true`.
- Если BFF запущен в Docker Compose, используйте `KAFKA_BROKERS=kafka:29092`; если BFF запущен локально без Docker, используйте `KAFKA_BROKERS=localhost:9092`.
- Topic погодных событий: `open-meteo.weather.v1`.

## Supabase

1. Выполните SQL из `backups/smart-home-supabase-seed-2026-04-21.sql` в Supabase SQL Editor, если нужна копия текущей локальной базы.
2. Выполните SQL из `backups/smart-home-supabase-premium-migration-2026-04-22.sql`, чтобы добавить таблицы подписки, Telegram и восстановления пароля.
3. Выполните SQL из `supabase/migrations/20260514_telemetry_pipeline_schema.sql`, чтобы добавить `hub_id`, `home_locations`, поля источника телеметрии и корректные FK.
4. Выполните SQL из `supabase/migrations/20260515_scenario_sources_manual_modes.sql`, чтобы добавить источники устройств, manual modes и `scenario_actions`.
5. Выполните SQL из `supabase/migrations/20260516_home_sensors.sql` и `supabase/migrations/20260517_schedule_reports.sql`.
6. Создайте локальный `.env` на основе `.env.example`.
7. Вставьте Supabase connection string в `DATABASE_URL`.
8. Оставьте `DATABASE_SSL=true` для Supabase pooler.
9. Для session-pooler оставьте `DATABASE_POOL_MAX=5`, чтобы BFF не раздувал число одновременных соединений.
10. Перезапустите BFF или `docker compose up --build`.

После перехода со старой demo-синусоиды домашних датчиков на плавную модель можно один раз выполнить `supabase/maintenance/20260602_reset_home_sensor_demo_telemetry.sql`. Скрипт удаляет только автоматически созданные домашние точки и не затрагивает Open-Meteo или ручную телеметрию.

Если `DATABASE_URL` пустой или схема Supabase не готова, runtime BFF не стартует.

## Погода

- Домашняя локация хранится в `home_locations` и задается через `/api/location/browser`.
- Dashboard на стороне BFF берет текущую погоду из Open-Meteo по координатам, кэширует ее на `WEATHER_CACHE_TTL_MS` и сохраняет точки в `telemetry_points`.
- Для погодных данных BFF создает отдельные системные Open-Meteo-датчики: температура, влажность, осадки и ветер; датчик наружной освещенности можно добавить вручную.
- Климатический график позволяет отдельно выбрать источник температуры и источник влажности; линии разных устройств не смешиваются.
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

## Postman

Для импорта используйте:

- `postman/SmartHome.postman_collection.json`
- `postman/SmartHome.local.postman_environment.json`

Коллекция покрывает все текущие REST-методы BFF, сохраняет JWT после логина и ID созданных сущностей в environment. Для локального запуска через CLI:

```bash
npm run postman:test
```

Для запросов восстановления пароля удобнее включить `EMAIL_PROVIDER=dev`, а для Telegram-запросов нужны реальные `telegramBotToken` и `telegramChatId`.

## Test IT

В репозитории есть manifest ручных кейсов и автотестов: `testit/manifest.json`.

```env
TMS_URL=https://your-testit.example
TMS_TOKEN=...
TMS_PROJECT_ID=...
TMS_CONFIGURATION_ID=...
```

Команды:

```bash
npm run test:junit
npm run postman:test
npm run testit:sync
npm run testit:upload
```

- `testit:sync` создает раздел `SmartHome`, ручные кейсы и карточки автотестов, затем связывает их по manifest.
- `testit:upload` отправляет JUnit XML из `test-results/` через установленный Test IT CLI.
- Если исходники лежат в GitHub, можно дополнительно задать `TMS_SOURCE_BASE_URL`, чтобы ссылки автотестов в Test IT вели сразу в репозиторий.

## Структура

- `apps/web` - React/Vite frontend по FSD: `app`, `pages`, `widgets`, `features`, `entities`, `shared`.
- `apps/bff` - Express BFF: `routes`, `services`, `repositories`, `db`, `domain`, `config`.
- `docker/backend.Dockerfile` - legacy-сборка Java backend, не используется в default runtime.

## Что делает BFF

- Хранит пользователей, устройства, сценарии, уведомления, локацию дома и телеметрию в Supabase/Postgres через `DATABASE_URL`.
- Выдает JWT для локальной авторизации.
- Дает frontend REST API.
- Проверяет Supabase-схему при старте и просит применить SQL-миграцию, если не хватает таблиц, колонок, индексов или FK.
- Генерирует показания домашних датчиков в фоновом цикле BFF и хранит их отдельно от Open-Meteo.
- Получает погодную телеметрию через Open-Meteo по домашней локации и сохраняет ее в Supabase.
- CRUD устройств/сценариев и ручные режимы работают через Supabase без gRPC-синхронизации.
