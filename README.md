# Smart Flow Home

Рабочий monorepo для интерфейса умного дома: React frontend, REST BFF и подключение к telemetry backend через gRPC collector.

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
2. Выполните SQL из `backups/smart-home-supabase-premium-migration-2026-04-22.sql`, чтобы добавить таблицы подписки, Telegram и восстановления пароля.
3. Создайте локальный `.env` на основе `.env.example`.
4. Вставьте Supabase connection string в `DATABASE_URL`.
5. Оставьте `DATABASE_SSL=true` для Supabase pooler.
6. Перезапустите BFF или `docker compose up --build`.

Если `DATABASE_URL` пустой, BFF продолжит использовать локальный SQLite-файл из `DB_PATH`.

## Почта, Telegram и подписка

- Подписка работает как mock-оплата: после формы оплаты пользователь получает Premium на 30 дней за `150 ₽/мес`.
- Telegram доступен Premium-пользователям. Bot token шифруется через `SECRETS_ENCRYPTION_KEY`; для production задайте свой длинный ключ.
- Восстановление пароля отправляет 6-значный код на email. Основной вариант - Resend Email API; SMTP оставлен как fallback.
- IT-новости берутся из RSS-лент `NEWS_RSS_FEEDS`; ключи внешних API не нужны.
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
- `apps/bff` - Express BFF: `routes`, `services`, `repositories`, `adapters/grpc`, `db`, `domain`, `config`.
- `docker/backend.Dockerfile` - сборка только `infra` и `telemetry` из backend GitHub, без `commerce`.

## Что делает BFF

- Хранит пользователей, устройства, сценарии, уведомления и телеметрию в SQLite по умолчанию или в Supabase/Postgres через `DATABASE_URL`.
- Выдает JWT для локальной авторизации.
- Дает frontend REST API.
- При создании/удалении устройств и сценариев отправляет hub events в telemetry collector.
- При переключении устройств и отправке телеметрии отправляет sensor events в telemetry collector.
- Если collector недоступен, UI продолжает работать, а BFF создает уведомление о проблеме синхронизации.
