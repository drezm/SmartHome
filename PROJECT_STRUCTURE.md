# Структура проекта Smart Flow Home

Документ описывает, что хранится в каждой папке и для чего нужен каждый файл, который находится в git. Локальные runtime-файлы (`.env`, SQLite-база, `node_modules`, `dist`, WAL/SHM-файлы) намеренно не входят в репозиторий и не описываются как часть исходного кода.

## Корень репозитория

Корень хранит общую конфигурацию monorepo, Docker Compose, документацию, lockfile зависимостей и общие TypeScript-настройки.

### `.dockerignore`

Список файлов и папок, которые не передаются в Docker build context. Нужен, чтобы Docker не копировал `node_modules`, локальные базы, `dist`, логи и прочие тяжелые или приватные артефакты.

### `.env.example`

Пример переменных окружения для локального запуска и Docker. В нем перечислены `JWT_SECRET`, `HUB_ID`, `BFF_PORT`, `DB_PATH`, `DATABASE_URL`, `DATABASE_SSL`, `COLLECTOR_GRPC_URL`, `CORS_ORIGIN`, `VITE_API_URL`.

Файл не содержит реальных секретов. Для настоящего запуска создается локальный `.env`, который не должен попадать в git.

### `.gitignore`

Правила исключения файлов из git. Закрывает от случайного commit:

- зависимости `node_modules`;
- сборки `dist`;
- локальные `.env`;
- SQLite-файлы и WAL/SHM;
- логи;
- Java `target`;
- служебные системные файлы.

### `README.md`

Краткая документация по запуску проекта. Описывает быстрый старт через Docker, локальный запуск, Supabase/Postgres, структуру monorepo и роль BFF.

### `PROJECT_STRUCTURE.md`

Этот файл. Нужен как подробная карта проекта: где лежит код, что делает каждая папка и какой смысл у каждого файла.

### `docker-compose.yml`

Основной compose-файл для запуска проекта без лишних ручных действий. Поднимает:

- `web` - frontend;
- `bff` - REST API адаптер;
- `kafka`;
- `kafka-init-topics`;
- `analyzer-db`;
- `discovery-server`;
- `config-server`;
- `collector`.

`commerce` не подключается. BFF может работать с SQLite или Supabase/Postgres через `DATABASE_URL`.

### `package.json`

Корневой npm manifest monorepo. Объявляет workspaces `apps/web` и `apps/bff`, а также общие scripts:

- `npm run dev`;
- `npm run dev:web`;
- `npm run dev:bff`;
- `npm run build`;
- `npm test`;
- `npm run typecheck`.

### `package-lock.json`

Зафиксированное дерево npm-зависимостей для всего monorepo. Нужен для воспроизводимой установки зависимостей на другой машине или в Docker.

### `tsconfig.base.json`

Базовая TypeScript-конфигурация, от которой наследуются frontend и BFF. Содержит общие strict-настройки компиляции.

## `docker/`

Папка с Dockerfile для сборки Java backend-компонентов из внешнего GitHub backend, но только из частей `infra` и `telemetry`.

### `docker/backend.Dockerfile`

Многостадийный Dockerfile для backend-сервисов:

- загружает исходный backend;
- исключает `commerce`;
- собирает нужные Java-модули;
- содержит targets для `discovery-server`, `config-server`, `collector`.

Используется в `docker-compose.yml`.

## `backups/`

Папка с SQL-дампами текущей базы. Нужна для переноса локального состояния в другую SQLite-базу или в Supabase/Postgres.

### `backups/smart-home-sqlite-backup-2026-04-21.sql`

Точный SQLite `.dump` текущей локальной базы. Содержит таблицы, индексы, связи и данные. Используется, если нужно восстановить локальную SQLite-копию.

### `backups/smart-home-supabase-seed-2026-04-21.sql`

Версия backup, подготовленная для Supabase/Postgres SQL Editor. Убирает SQLite-специфичные команды и добавляет безопасный порядок пересоздания таблиц.

## `apps/`

Папка приложений monorepo. Внутри два самостоятельных workspace:

- `apps/web` - браузерный интерфейс;
- `apps/bff` - backend-for-frontend REST API.

## `apps/bff/`

Node.js + Express + TypeScript BFF. Он является REST API для frontend, хранит состояние UI, управляет авторизацией, работает с SQLite или Supabase/Postgres и отправляет важные события в telemetry collector через gRPC.

### `apps/bff/Dockerfile`

Dockerfile для сборки BFF. Устанавливает зависимости, собирает TypeScript и запускает production-сервер.

### `apps/bff/package.json`

npm manifest BFF workspace. Содержит scripts `dev`, `build`, `start`, `test`, `typecheck`, а также зависимости Express, JWT, Zod, SQLite, Postgres client, gRPC и тестовые библиотеки.

### `apps/bff/tsconfig.json`

TypeScript-конфигурация BFF. Наследуется от `tsconfig.base.json` и задает параметры сборки серверного кода.

### `apps/bff/vitest.config.ts`

Конфигурация Vitest для BFF-тестов.

## `apps/bff/src/`

Исходный код BFF.

### `apps/bff/src/server.ts`

Точка входа BFF. Создает runtime-приложение через `createRuntimeApp()` и запускает Express на `BFF_PORT`.

### `apps/bff/src/app.ts`

Собирает Express-приложение:

- подключает middleware;
- выбирает хранилище SQLite или Postgres;
- создает `AuthService` и `HomeService`;
- регистрирует `/api/health`, auth routes и home routes;
- подключает общий error handler.

## `apps/bff/src/config/`

Конфигурация окружения BFF.

### `apps/bff/src/config/env.ts`

Парсит переменные окружения через Zod. Задает дефолты для локального запуска и валидирует:

- порт BFF;
- JWT-настройки;
- hub id;
- SQLite path;
- Postgres/Supabase URL;
- SSL для Postgres;
- collector gRPC URL;
- CORS origin.

## `apps/bff/src/db/`

Инициализация баз данных и миграции.

### `apps/bff/src/db/database.ts`

SQLite-реализация базы по умолчанию. Создает таблицы, индексы, включает foreign keys и WAL-режим. Также seed-ит demo-пользователя и demo-данные для локального старта.

### `apps/bff/src/db/postgres.ts`

Postgres/Supabase подключение через `pg.Pool`. Выполняет миграции таблиц и индексов при старте BFF, если задан `DATABASE_URL`.

## `apps/bff/src/domain/`

Доменные типы приложения.

### `apps/bff/src/domain/types.ts`

Общие TypeScript-типы BFF:

- `User`;
- `AuthSession`;
- `Device`;
- `Scenario`;
- `TelemetryPoint`;
- `NotificationItem`;
- `DashboardSummary`;
- перечисления типов устройств, сценариев и quick actions.

Эти типы задают контракт между сервисами, репозиториями и REST API.

## `apps/bff/src/middleware/`

Express middleware.

### `apps/bff/src/middleware/asyncHandler.ts`

Обертка для async route handlers. Передает ошибки в Express `next`, чтобы не писать `try/catch` в каждом endpoint.

### `apps/bff/src/middleware/auth.ts`

JWT middleware. Берет `Authorization: Bearer ...`, проверяет токен через `AuthService`, добавляет `request.user` или возвращает `401`.

### `apps/bff/src/middleware/errorHandler.ts`

Единый обработчик ошибок API. Преобразует Zod validation errors и обычные ошибки в JSON-ответы.

## `apps/bff/src/routes/`

REST API endpoints BFF.

### `apps/bff/src/routes/authRoutes.ts`

Маршруты авторизации:

- `POST /api/auth/register`;
- `POST /api/auth/login`;
- `GET /api/auth/me`.

Валидирует body через Zod и вызывает `AuthService`.

### `apps/bff/src/routes/homeRoutes.ts`

Основные защищенные маршруты приложения:

- dashboard;
- devices CRUD;
- scenarios CRUD;
- telemetry;
- notifications;
- quick actions.

Все маршруты требуют JWT через `authMiddleware`.

## `apps/bff/src/services/`

Бизнес-логика BFF.

### `apps/bff/src/services/authService.ts`

Логика регистрации, логина и проверки JWT. Хэширует пароли через `bcrypt`, подписывает JWT и работает через абстрактный `UserStore`, чтобы не зависеть напрямую от SQLite или Postgres.

### `apps/bff/src/services/homeService.ts`

Логика умного дома:

- CRUD устройств и сценариев;
- quick actions;
- dashboard aggregation;
- уведомления;
- телеметрия;
- синхронизация с collector через gRPC.

Если collector недоступен, сохраняет данные локально/в Supabase и создает уведомление о проблеме синхронизации.

## `apps/bff/src/repositories/`

Слой доступа к данным. Здесь спрятаны SQL-запросы и различия между SQLite и Postgres.

### `apps/bff/src/repositories/contracts.ts`

Интерфейсы `UserStore` и `HomeStore`. Описывают методы, которые нужны сервисам, независимо от конкретной базы.

### `apps/bff/src/repositories/userRepository.ts`

SQLite-репозиторий пользователей. Ищет пользователей по email/id, создает пользователя и seed-ит для него demo smart home данные.

### `apps/bff/src/repositories/homeRepository.ts`

SQLite-репозиторий умного дома. Хранит SQL для устройств, сценариев, уведомлений, телеметрии и quick actions.

### `apps/bff/src/repositories/postgresUserRepository.ts`

Postgres/Supabase-репозиторий пользователей. Делает те же операции, что `userRepository.ts`, но через `pg` и SQL-параметры `$1`, `$2`.

### `apps/bff/src/repositories/postgresHomeRepository.ts`

Postgres/Supabase-репозиторий данных умного дома. Реализует `HomeStore` для devices, scenarios, notifications, telemetry и quick actions.

### `apps/bff/src/repositories/postgresSeed.ts`

Seed-логика demo-данных для нового пользователя в Postgres/Supabase. Создает стартовые устройства, сценарии, уведомления и температурную телеметрию.

## `apps/bff/src/adapters/`

Папка внешних интеграций BFF.

## `apps/bff/src/adapters/grpc/`

Интеграция с telemetry collector через gRPC.

### `apps/bff/src/adapters/grpc/collectorClient.ts`

gRPC-клиент collector. Умеет отправлять:

- device added/removed;
- scenario added/removed;
- switch state;
- telemetry events.

Также поддерживает локальный режим `COLLECTOR_GRPC_URL=disabled`, чтобы UI и BFF работали без запущенного collector.

## `apps/bff/src/adapters/grpc/protos/`

Скопированные proto-контракты telemetry backend. Нужны, чтобы Node.js BFF мог вызывать Java collector по gRPC.

### `apps/bff/src/adapters/grpc/protos/telemetry/messages/hub_event.proto`

Описание gRPC/Protobuf сообщений hub events: добавление/удаление устройств и сценариев, данные hub-уровня.

### `apps/bff/src/adapters/grpc/protos/telemetry/messages/sensor_event.proto`

Описание sensor events: телеметрия, состояния датчиков и переключателей.

### `apps/bff/src/adapters/grpc/protos/telemetry/services/collector_controller.proto`

Описание gRPC-сервиса collector controller и методов, которые вызывает BFF.

## `apps/bff/src/test/`

Интеграционные тесты BFF.

### `apps/bff/src/test/auth.test.ts`

Проверяет регистрацию, получение текущего пользователя по JWT и логин demo-аккаунта.

### `apps/bff/src/test/home.test.ts`

Проверяет список устройств, dashboard summary и создание сценария.

## `apps/web/`

React + Vite + TypeScript frontend. Построен по FSD-подходу: `app`, `pages`, `widgets`, `features`, `entities`, `shared`.

### `apps/web/Dockerfile`

Dockerfile frontend. Собирает Vite-приложение и запускает preview-сервер внутри контейнера.

### `apps/web/index.html`

HTML-шаблон Vite. Содержит root element, куда монтируется React-приложение.

### `apps/web/package.json`

npm manifest frontend workspace. Содержит scripts `dev`, `build`, `preview`, `test`, `typecheck` и зависимости React, Router, TanStack Query, Recharts, Framer Motion, Lucide, Tailwind, Vitest.

### `apps/web/postcss.config.js`

PostCSS-конфигурация для Tailwind CSS и Autoprefixer.

### `apps/web/tailwind.config.ts`

Tailwind-конфигурация. Указывает пути к исходникам и тему проекта.

### `apps/web/tsconfig.json`

Root TypeScript config frontend workspace. Ссылается на app/node конфиги.

### `apps/web/tsconfig.app.json`

TypeScript config для React-кода приложения.

### `apps/web/tsconfig.node.json`

TypeScript config для Node/Vite config-файлов.

### `apps/web/vite.config.ts`

Vite-конфигурация frontend. Настраивает React plugin, alias `@` на `src`, dev proxy на BFF и test setup.

### `apps/web/vitest.config.ts`

Конфигурация Vitest для frontend unit-тестов.

## `apps/web/src/`

Исходный код React-приложения.

### `apps/web/src/main.tsx`

Точка входа frontend. Монтирует React в DOM и подключает providers: Query, Theme, Auth.

### `apps/web/src/vite-env.d.ts`

TypeScript declarations для Vite environment.

## `apps/web/src/app/`

Application layer: роутинг, глобальные стили и провайдеры.

### `apps/web/src/app/App.tsx`

Главный React-компонент с маршрутизацией. Описывает публичные страницы auth и защищенные страницы внутри `AppShell`.

### `apps/web/src/app/styles.css`

Глобальные стили Tailwind и overrides светлой темы. Здесь описаны цвета body, light theme compatibility для Tailwind-классов, контраст текста, бейджей, карточек и графиков.

## `apps/web/src/app/providers/`

React context providers приложения.

### `apps/web/src/app/providers/AuthProvider.tsx`

Хранит JWT и пользователя на frontend. Загружает `/auth/me`, сохраняет token в localStorage, предоставляет `setSession` и `logout`.

### `apps/web/src/app/providers/QueryProvider.tsx`

Создает `QueryClient` TanStack Query и подключает `QueryClientProvider`.

### `apps/web/src/app/providers/ThemeProvider.tsx`

Управляет темной/светлой темой. Хранит выбор в localStorage и ставит class на root HTML element.

## `apps/web/src/pages/`

Страницы приложения. Каждая папка соответствует route.

### `apps/web/src/pages/auth/AuthPage.tsx`

Страница входа/регистрации. Показывает брендовый экран и `AuthForm`. Если пользователь уже авторизован, перенаправляет на dashboard.

### `apps/web/src/pages/dashboard/DashboardPage.tsx`

Главный dashboard. Отображает статистику, quick actions, графики температуры/активности, текущий сценарий и состояние collector.

### `apps/web/src/pages/devices/DevicesPage.tsx`

Страница устройств. Загружает список устройств, дает поиск, переключение состояния и открывает modal добавления устройства.

### `apps/web/src/pages/scenarios/ScenariosPage.tsx`

Страница сценариев автоматизации. Показывает сценарии, позволяет включать/выключать их и создавать новый сценарий.

### `apps/web/src/pages/notifications/NotificationsPage.tsx`

Страница уведомлений. Содержит tabs для всех, непрочитанных и системных уведомлений; при клике помечает уведомления прочитанными.

### `apps/web/src/pages/analytics/AnalyticsPage.tsx`

Страница аналитики. Показывает график активности и последние события.

### `apps/web/src/pages/profile/ProfilePage.tsx`

Личный кабинет. Содержит tabs профиля, безопасности и интеграций.

### `apps/web/src/pages/settings/SettingsPage.tsx`

Настройки приложения. Показывает API endpoints и состояние collector/backend-интеграции.

## `apps/web/src/widgets/`

Крупные композиционные блоки интерфейса, которые собирают features/entities/shared UI.

### `apps/web/src/widgets/app-shell/AppShell.tsx`

Основной layout авторизованного приложения:

- sidebar на desktop;
- mobile navigation;
- header;
- кнопка темы;
- выход;
- отображение статуса сети и профиля.

### `apps/web/src/widgets/dashboard/SectionTitle.tsx`

Переиспользуемый заголовок секций с title и description.

### `apps/web/src/widgets/dashboard/StatCard.tsx`

Карточка статистики для dashboard/auth preview: иконка, значение, подпись.

## `apps/web/src/features/`

Функциональные пользовательские действия и формы.

### `apps/web/src/features/auth/AuthForm.tsx`

Форма входа/регистрации. Отправляет login/register запросы, сохраняет сессию через `AuthProvider` и перенаправляет пользователя.

### `apps/web/src/features/auth/AuthForm.test.tsx`

Frontend unit-тест формы авторизации.

### `apps/web/src/features/devices/CreateDeviceModal.tsx`

Модальное окно добавления устройства. Реализует пошаговый wizard: тип устройства, параметры, подтверждение.

### `apps/web/src/features/scenarios/CreateScenarioModal.tsx`

Модальное окно создания сценария. Позволяет выбрать условие, оператор, значение, устройство и действие.

### `apps/web/src/features/quick-actions/QuickActions.tsx`

Блок быстрых действий: включить свет, выключить все, ночной режим, утренний режим. Отправляет `POST /quick-actions`.

## `apps/web/src/entities/`

Представление доменных сущностей UI.

### `apps/web/src/entities/device/DeviceCard.tsx`

Карточка устройства. Показывает иконку, название, категорию, комнату, metric, статус связи/включения и switch.

### `apps/web/src/entities/device/deviceIcon.ts`

Сопоставление типов/категорий устройств с иконками Lucide и список опций для формы добавления устройства.

### `apps/web/src/entities/scenario/ScenarioCard.tsx`

Карточка сценария. Показывает title, условие, действие и switch активности.

### `apps/web/src/entities/notification/NotificationRow.tsx`

Строка уведомления. Показывает тип события, заголовок, время и состояние unread.

## `apps/web/src/shared/`

Переиспользуемые общие модули frontend: API, утилиты, UI-kit.

## `apps/web/src/shared/api/`

REST API клиент frontend.

### `apps/web/src/shared/api/http.ts`

Обертка над `fetch`. Подставляет `VITE_API_URL`, добавляет JWT из localStorage, обрабатывает ошибки и содержит методы API: auth, dashboard, devices, scenarios, telemetry, notifications, quick actions.

### `apps/web/src/shared/api/queryKeys.ts`

Единые ключи TanStack Query. Нужны, чтобы инвалидировать и переиспользовать запросы без строковых ошибок.

### `apps/web/src/shared/api/types.ts`

TypeScript-типы frontend для данных API: user, session, device, scenario, dashboard, notification, telemetry.

## `apps/web/src/shared/lib/`

Мелкие утилиты.

### `apps/web/src/shared/lib/backendStatus.ts`

Преобразует backend collector status в UI-view: label, detail, badge classes, text classes и boolean ok.

### `apps/web/src/shared/lib/cn.ts`

Мини-утилита для склейки className строк. Используется в UI-компонентах.

## `apps/web/src/shared/ui/`

Локальный UI-kit проекта. Это небольшие переиспользуемые компоненты вместо тяжелой внешней UI-библиотеки.

### `apps/web/src/shared/ui/Avatar.tsx`

Компоненты `Avatar` и `AvatarFallback` для отображения пользователя.

### `apps/web/src/shared/ui/Badge.tsx`

Компонент бейджа/статуса.

### `apps/web/src/shared/ui/Button.tsx`

Кнопка с вариантами `primary`, `soft`, `ghost`, `danger`.

### `apps/web/src/shared/ui/Card.tsx`

Карточка и ее части: `Card`, `CardHeader`, `CardTitle`, `CardDescription`, `CardContent`.

### `apps/web/src/shared/ui/Input.tsx`

Стилизованный input.

### `apps/web/src/shared/ui/Modal.tsx`

Адаптивное модальное окно с overlay, заголовком, описанием и кнопкой закрытия.

### `apps/web/src/shared/ui/Progress.tsx`

Прогресс-бар.

### `apps/web/src/shared/ui/Select.tsx`

Стилизованный select.

### `apps/web/src/shared/ui/Switch.tsx`

Toggle switch для устройств, сценариев и настроек.

### `apps/web/src/shared/ui/Tabs.tsx`

Компонент вкладок, адаптированный под мобильные экраны.

## `apps/web/src/test/`

Frontend test setup.

### `apps/web/src/test/setup.ts`

Подключает `@testing-library/jest-dom` для Vitest.

