-- Smart Flow Home database backup for Supabase/Postgres
-- Generated from apps/bff/data/smart-home.sqlite on 2026-04-21.
-- Contains schema, foreign keys, indexes, users, devices, scenarios, notifications, telemetry.
SET client_encoding = 'UTF8';
SET search_path = public;

BEGIN;

DROP TABLE IF EXISTS telemetry_points CASCADE;
DROP TABLE IF EXISTS notifications CASCADE;
DROP TABLE IF EXISTS scenarios CASCADE;
DROP TABLE IF EXISTS devices CASCADE;
DROP TABLE IF EXISTS users CASCADE;
CREATE TABLE users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
INSERT INTO users VALUES('7bbe3674-8870-44bc-8ca9-66712a6bbaf3','Матвей Саблуков','matvey@example.com','$2a$10$Erzh/3P9asYGBo3zdoNe0uQobQNtjjEufhykdCecQepIfh8jd2qHa','2026-04-21T11:02:22.394Z');
INSERT INTO users VALUES('39b15acb-a0fa-45ec-bd59-49534f456078','Кот','matfgvey@example.com','$2a$10$hsGVaBJLSl7inZRc6y2NBuSuYOkF1AYhFgyrvhYxQizzPSE8KoD6O','2026-04-21T11:08:27.245Z');
CREATE TABLE devices (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      category TEXT NOT NULL,
      room TEXT NOT NULL,
      online INTEGER NOT NULL DEFAULT 1,
      enabled INTEGER NOT NULL DEFAULT 0,
      metric TEXT,
      last_seen TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
INSERT INTO devices VALUES('living-light','7bbe3674-8870-44bc-8ca9-66712a6bbaf3','Лампа в гостиной','LIGHT_SENSOR','Освещение','Гостиная',1,1,NULL,'2026-04-21T11:35:38.526Z','2026-04-21T11:02:22.478Z');
INSERT INTO devices VALUES('bedroom-climate','7bbe3674-8870-44bc-8ca9-66712a6bbaf3','Кондиционер','CLIMATE_SENSOR','Климат','Спальня',1,1,'24°C','2026-04-21T11:35:38.526Z','2026-04-21T11:02:22.478Z');
INSERT INTO devices VALUES('kitchen-temp','7bbe3674-8870-44bc-8ca9-66712a6bbaf3','Датчик температуры','TEMPERATURE_SENSOR','Датчики','Кухня',1,1,'26°C','2026-04-21T11:32:59.975Z','2026-04-21T11:02:22.478Z');
INSERT INTO devices VALUES('office-plug','7bbe3674-8870-44bc-8ca9-66712a6bbaf3','Умная розетка','SWITCH_SENSOR','Розетки','Кабинет',0,1,NULL,'2026-04-21T11:33:02.392Z','2026-04-21T11:02:22.478Z');
INSERT INTO devices VALUES('bedroom-humidity','7bbe3674-8870-44bc-8ca9-66712a6bbaf3','Увлажнитель','CLIMATE_SENSOR','Климат','Спальня',1,0,'45%','2026-04-21T11:36:28.143Z','2026-04-21T11:02:22.478Z');
INSERT INTO devices VALUES('hall-motion','7bbe3674-8870-44bc-8ca9-66712a6bbaf3','Датчик движения','MOTION_SENSOR','Безопасность','Коридор',1,0,NULL,'2026-04-21T11:09:35.424Z','2026-04-21T11:02:22.478Z');
CREATE TABLE scenarios (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      title TEXT NOT NULL,
      metric TEXT NOT NULL,
      operator TEXT NOT NULL,
      value REAL NOT NULL,
      unit TEXT,
      target_device_id TEXT,
      target_device_name TEXT NOT NULL,
      command TEXT NOT NULL,
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (target_device_id) REFERENCES devices(id) ON DELETE SET NULL
    );
INSERT INTO scenarios VALUES('auto-cooling','7bbe3674-8870-44bc-8ca9-66712a6bbaf3','Автоохлаждение','Температура','>',25.0,'°C','bedroom-climate','Кондиционер','Включить',1,'2026-04-21T11:02:22.478Z');
INSERT INTO scenarios VALUES('night-mode','7bbe3674-8870-44bc-8ca9-66712a6bbaf3','Ночной режим','Выключатель','=',1.0,NULL,'living-light','Лампа в гостиной','Выключить',0,'2026-04-21T11:02:22.478Z');
INSERT INTO scenarios VALUES('cozy-evening','7bbe3674-8870-44bc-8ca9-66712a6bbaf3','Уютный вечер','Движение','=',1.0,NULL,'living-light','Лампа в гостиной','Включить',0,'2026-04-21T11:02:22.478Z');
INSERT INTO scenarios VALUES('adf7ad83-e076-44d9-9b0c-8c55a4095a08','7bbe3674-8870-44bc-8ca9-66712a6bbaf3','Жара','Температура','>',25.0,'%','living-light','Лампа в гостиной','Включить',0,'2026-04-21T11:07:42.124Z');
CREATE TABLE notifications (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      title TEXT NOT NULL,
      type TEXT NOT NULL,
      unread INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
INSERT INTO notifications VALUES('95461969-db3c-4c05-a370-0acab7920688','7bbe3674-8870-44bc-8ca9-66712a6bbaf3','Температура выше 25°C в гостиной','temperature',0,'2026-04-21T11:02:22.478Z');
INSERT INTO notifications VALUES('29990a91-9b27-42e2-b321-3dedfcd24865','7bbe3674-8870-44bc-8ca9-66712a6bbaf3','Движение в коридоре','motion',0,'2026-04-21T11:02:22.478Z');
INSERT INTO notifications VALUES('25a9f1de-14c7-47af-bde9-319bfcdfa95f','7bbe3674-8870-44bc-8ca9-66712a6bbaf3','Свет на кухне включен','device',0,'2026-04-21T11:02:22.478Z');
INSERT INTO notifications VALUES('3b3237d9-f100-48c3-8b89-cfa25813853d','7bbe3674-8870-44bc-8ca9-66712a6bbaf3','Collector недоступен: локальный режим работает без gRPC-синхронизации','system',0,'2026-04-21T11:03:41.958Z');
INSERT INTO notifications VALUES('f7d9974f-6c8c-47b3-833e-2ce3f1073c42','7bbe3674-8870-44bc-8ca9-66712a6bbaf3','Включен свет в доме','system',0,'2026-04-21T11:03:41.959Z');
INSERT INTO notifications VALUES('c36dbcb4-efc2-434d-ae3a-401ccd6ae417','7bbe3674-8870-44bc-8ca9-66712a6bbaf3','Collector недоступен: локальный режим работает без gRPC-синхронизации','system',0,'2026-04-21T11:03:49.035Z');
INSERT INTO notifications VALUES('670952bc-6811-4169-ad66-dcc0cf4df153','7bbe3674-8870-44bc-8ca9-66712a6bbaf3','Collector недоступен: локальный режим работает без gRPC-синхронизации','system',0,'2026-04-21T11:03:49.035Z');
INSERT INTO notifications VALUES('a130d6f5-2f26-4dc2-9b73-471fd401a0be','7bbe3674-8870-44bc-8ca9-66712a6bbaf3','Collector недоступен: локальный режим работает без gRPC-синхронизации','system',0,'2026-04-21T11:03:49.036Z');
INSERT INTO notifications VALUES('8e6dae6b-aaf8-4853-8188-03ead41b8e28','7bbe3674-8870-44bc-8ca9-66712a6bbaf3','Collector недоступен: локальный режим работает без gRPC-синхронизации','system',0,'2026-04-21T11:03:49.036Z');
INSERT INTO notifications VALUES('ce31734c-8481-42ba-bff1-8739b2ab04f5','7bbe3674-8870-44bc-8ca9-66712a6bbaf3','Collector недоступен: локальный режим работает без gRPC-синхронизации','system',0,'2026-04-21T11:03:49.036Z');
INSERT INTO notifications VALUES('0bfe0f44-cb94-4457-a718-03409b48b7cf','7bbe3674-8870-44bc-8ca9-66712a6bbaf3','Collector недоступен: локальный режим работает без gRPC-синхронизации','system',0,'2026-04-21T11:03:49.036Z');
INSERT INTO notifications VALUES('e550a79d-0028-45d3-9a80-250e9d36d129','7bbe3674-8870-44bc-8ca9-66712a6bbaf3','Все устройства выключены','system',0,'2026-04-21T11:03:49.036Z');
INSERT INTO notifications VALUES('16a7c64c-e718-4e6c-92b4-c26d024ba0ce','7bbe3674-8870-44bc-8ca9-66712a6bbaf3','Collector недоступен: локальный режим работает без gRPC-синхронизации','system',0,'2026-04-21T11:03:50.301Z');
INSERT INTO notifications VALUES('0268192a-4204-4a3a-bd71-7244e12988bb','7bbe3674-8870-44bc-8ca9-66712a6bbaf3','Collector недоступен: локальный режим работает без gRPC-синхронизации','system',0,'2026-04-21T11:03:50.301Z');
INSERT INTO notifications VALUES('06324e12-5b87-4913-b8ae-24e94a6c5717','7bbe3674-8870-44bc-8ca9-66712a6bbaf3','Collector недоступен: локальный режим работает без gRPC-синхронизации','system',0,'2026-04-21T11:03:50.301Z');
INSERT INTO notifications VALUES('5b14a363-35b1-4efc-adea-b2dcc9561d13','7bbe3674-8870-44bc-8ca9-66712a6bbaf3','Collector недоступен: локальный режим работает без gRPC-синхронизации','system',0,'2026-04-21T11:03:50.302Z');
INSERT INTO notifications VALUES('c3eba162-3b3f-48d2-824c-37bcc04ec547','7bbe3674-8870-44bc-8ca9-66712a6bbaf3','Collector недоступен: локальный режим работает без gRPC-синхронизации','system',0,'2026-04-21T11:03:50.302Z');
INSERT INTO notifications VALUES('84a8fcb8-9963-4a26-8057-2391d247995f','7bbe3674-8870-44bc-8ca9-66712a6bbaf3','Collector недоступен: локальный режим работает без gRPC-синхронизации','system',0,'2026-04-21T11:03:50.302Z');
INSERT INTO notifications VALUES('5eb63110-920a-4c87-a253-a2002d8c8bf8','7bbe3674-8870-44bc-8ca9-66712a6bbaf3','Активирован ночной режим','system',0,'2026-04-21T11:03:50.302Z');
INSERT INTO notifications VALUES('ec1b7b46-d923-47d7-8771-84d60059c53d','7bbe3674-8870-44bc-8ca9-66712a6bbaf3','Collector недоступен: локальный режим работает без gRPC-синхронизации','system',0,'2026-04-21T11:03:51.458Z');
INSERT INTO notifications VALUES('c125ff0b-e32a-4ce1-af74-6ba92994f044','7bbe3674-8870-44bc-8ca9-66712a6bbaf3','Collector недоступен: локальный режим работает без gRPC-синхронизации','system',0,'2026-04-21T11:03:51.463Z');
INSERT INTO notifications VALUES('08b43795-f8b8-4d24-997e-9b4569e28fbc','7bbe3674-8870-44bc-8ca9-66712a6bbaf3','Collector недоступен: локальный режим работает без gRPC-синхронизации','system',0,'2026-04-21T11:03:51.466Z');
INSERT INTO notifications VALUES('92554bb3-cdcf-4a2c-93af-df8a22948e88','7bbe3674-8870-44bc-8ca9-66712a6bbaf3','Активирован утренний режим','system',0,'2026-04-21T11:03:51.466Z');
INSERT INTO notifications VALUES('1ebe5e05-3a93-4d7c-8791-6c185dc0a8c5','7bbe3674-8870-44bc-8ca9-66712a6bbaf3','Collector недоступен: локальный режим работает без gRPC-синхронизации','system',0,'2026-04-21T11:07:42.140Z');
INSERT INTO notifications VALUES('a6f9e34e-ba99-44d0-843b-bac6a24ccdee','39b15acb-a0fa-45ec-bd59-49534f456078','Температура выше 25°C в гостиной','temperature',1,'2026-04-21T11:08:27.245Z');
INSERT INTO notifications VALUES('cd8fd9ba-d4a7-42c4-a0ff-8c2249a9a69f','39b15acb-a0fa-45ec-bd59-49534f456078','Движение в коридоре','motion',1,'2026-04-21T11:08:27.245Z');
INSERT INTO notifications VALUES('417af0c5-e52f-484d-b3d6-dbfd950a1ff4','39b15acb-a0fa-45ec-bd59-49534f456078','Свет на кухне включен','device',0,'2026-04-21T11:08:27.245Z');
INSERT INTO notifications VALUES('3cad1309-bdd6-466b-8de1-baba1a0fe1e4','39b15acb-a0fa-45ec-bd59-49534f456078','Активирован утренний режим','system',1,'2026-04-21T11:08:55.596Z');
INSERT INTO notifications VALUES('8a3e0e6d-c2d1-47aa-9887-2e61dc1a1694','39b15acb-a0fa-45ec-bd59-49534f456078','Активирован утренний режим','system',1,'2026-04-21T11:08:56.457Z');
INSERT INTO notifications VALUES('fadcbe3b-e89f-4a3c-a153-d9ee9f8e9063','39b15acb-a0fa-45ec-bd59-49534f456078','Активирован утренний режим','system',1,'2026-04-21T11:08:57.057Z');
INSERT INTO notifications VALUES('be80aa91-864e-4ec7-99dd-043a68e66a52','39b15acb-a0fa-45ec-bd59-49534f456078','Активирован ночной режим','system',1,'2026-04-21T11:08:59.790Z');
INSERT INTO notifications VALUES('dc43c92b-a69a-4e9b-b35f-21fc901a084c','39b15acb-a0fa-45ec-bd59-49534f456078','Все устройства выключены','system',1,'2026-04-21T11:09:00.606Z');
INSERT INTO notifications VALUES('91f9c3fb-e1c7-4204-a798-9fc49fb4fc4a','39b15acb-a0fa-45ec-bd59-49534f456078','Включен свет в доме','system',1,'2026-04-21T11:09:22.575Z');
INSERT INTO notifications VALUES('8976339c-9ecb-4bcc-8e5b-c4b3d1bd5437','7bbe3674-8870-44bc-8ca9-66712a6bbaf3','Collector недоступен: локальный режим работает без gRPC-синхронизации','system',0,'2026-04-21T11:09:35.427Z');
INSERT INTO notifications VALUES('c30b710d-81c3-4538-91e9-a89e121489e9','7bbe3674-8870-44bc-8ca9-66712a6bbaf3','Collector недоступен: локальный режим работает без gRPC-синхронизации','system',0,'2026-04-21T11:09:35.428Z');
INSERT INTO notifications VALUES('b8dd5052-5395-4bbb-896a-f30375e2363a','7bbe3674-8870-44bc-8ca9-66712a6bbaf3','Collector недоступен: локальный режим работает без gRPC-синхронизации','system',0,'2026-04-21T11:09:35.428Z');
INSERT INTO notifications VALUES('6ecd4216-c8f4-4567-ae1a-57128fd7b6c8','7bbe3674-8870-44bc-8ca9-66712a6bbaf3','Collector недоступен: локальный режим работает без gRPC-синхронизации','system',0,'2026-04-21T11:09:35.428Z');
INSERT INTO notifications VALUES('8ea21781-4bf4-4ea1-8beb-1a8904b6fb76','7bbe3674-8870-44bc-8ca9-66712a6bbaf3','Collector недоступен: локальный режим работает без gRPC-синхронизации','system',0,'2026-04-21T11:09:35.428Z');
INSERT INTO notifications VALUES('7119aecc-5d35-4418-b49c-26c3c129384a','7bbe3674-8870-44bc-8ca9-66712a6bbaf3','Collector недоступен: локальный режим работает без gRPC-синхронизации','system',0,'2026-04-21T11:09:35.428Z');
INSERT INTO notifications VALUES('0c52a02e-52bb-4260-97ee-1e6e0a7162a3','7bbe3674-8870-44bc-8ca9-66712a6bbaf3','Все устройства выключены','system',0,'2026-04-21T11:09:35.428Z');
INSERT INTO notifications VALUES('8ff8a318-95aa-4590-a71b-06b279d002f2','7bbe3674-8870-44bc-8ca9-66712a6bbaf3','Активирован утренний режим','system',0,'2026-04-21T11:35:38.528Z');
CREATE TABLE telemetry_points (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      device_id TEXT NOT NULL,
      kind TEXT NOT NULL,
      value REAL NOT NULL,
      unit TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (device_id) REFERENCES devices(id) ON DELETE CASCADE
    );
INSERT INTO telemetry_points VALUES('db07b7d5-ccdc-434f-b02a-81ed90e3e4e8','7bbe3674-8870-44bc-8ca9-66712a6bbaf3','kitchen-temp','temperature',22.0,'°C','2026-04-20T12:02:22.479Z');
INSERT INTO telemetry_points VALUES('8a1060b2-61bd-4666-a0ef-4b2d7ad373be','7bbe3674-8870-44bc-8ca9-66712a6bbaf3','kitchen-temp','temperature',21.0,'°C','2026-04-20T14:02:22.479Z');
INSERT INTO telemetry_points VALUES('e54aab4c-74f3-4b4f-81dd-7a730ae7aa22','7bbe3674-8870-44bc-8ca9-66712a6bbaf3','kitchen-temp','temperature',20.0,'°C','2026-04-20T17:02:22.479Z');
INSERT INTO telemetry_points VALUES('d6769a15-2a90-43be-aa83-fe243ead023e','7bbe3674-8870-44bc-8ca9-66712a6bbaf3','kitchen-temp','temperature',23.0,'°C','2026-04-20T20:02:22.479Z');
INSERT INTO telemetry_points VALUES('0bae0dba-c718-49f9-9a0f-3007ded0faa4','7bbe3674-8870-44bc-8ca9-66712a6bbaf3','kitchen-temp','temperature',26.0,'°C','2026-04-20T23:02:22.479Z');
INSERT INTO telemetry_points VALUES('b52fb9a5-b148-455c-b133-314ef91903fc','7bbe3674-8870-44bc-8ca9-66712a6bbaf3','kitchen-temp','temperature',27.0,'°C','2026-04-21T02:02:22.479Z');
INSERT INTO telemetry_points VALUES('12495979-0f4c-419d-98bf-0c52761c7160','7bbe3674-8870-44bc-8ca9-66712a6bbaf3','kitchen-temp','temperature',25.0,'°C','2026-04-21T05:02:22.479Z');
INSERT INTO telemetry_points VALUES('7e6ff88c-1b70-494d-9cb5-407b450b89c6','7bbe3674-8870-44bc-8ca9-66712a6bbaf3','kitchen-temp','temperature',23.0,'°C','2026-04-21T08:02:22.479Z');
INSERT INTO telemetry_points VALUES('065d11d5-542d-442f-896f-b7b054b744af','39b15acb-a0fa-45ec-bd59-49534f456078','kitchen-temp','temperature',22.0,'°C','2026-04-20T12:08:27.245Z');
INSERT INTO telemetry_points VALUES('f4250d6e-0629-4407-a986-4aac57c9ca40','39b15acb-a0fa-45ec-bd59-49534f456078','kitchen-temp','temperature',21.0,'°C','2026-04-20T14:08:27.245Z');
INSERT INTO telemetry_points VALUES('a872de71-c0c5-4176-9ef4-46145945db4a','39b15acb-a0fa-45ec-bd59-49534f456078','kitchen-temp','temperature',20.0,'°C','2026-04-20T17:08:27.245Z');
INSERT INTO telemetry_points VALUES('fc2e0c5b-ce1b-4c76-9d6e-b762bd6b5da7','39b15acb-a0fa-45ec-bd59-49534f456078','kitchen-temp','temperature',23.0,'°C','2026-04-20T20:08:27.245Z');
INSERT INTO telemetry_points VALUES('904a13aa-4b8d-4f70-b8b4-5b73e24a7b15','39b15acb-a0fa-45ec-bd59-49534f456078','kitchen-temp','temperature',26.0,'°C','2026-04-20T23:08:27.245Z');
INSERT INTO telemetry_points VALUES('5eba386a-28f1-407f-b109-442ac57453b8','39b15acb-a0fa-45ec-bd59-49534f456078','kitchen-temp','temperature',27.0,'°C','2026-04-21T02:08:27.245Z');
INSERT INTO telemetry_points VALUES('e134ddf7-9194-484a-b8d0-8a1fe4c84ae8','39b15acb-a0fa-45ec-bd59-49534f456078','kitchen-temp','temperature',25.0,'°C','2026-04-21T05:08:27.245Z');
INSERT INTO telemetry_points VALUES('4f8742d1-11da-4d30-82fc-645310ca795f','39b15acb-a0fa-45ec-bd59-49534f456078','kitchen-temp','temperature',23.0,'°C','2026-04-21T08:08:27.245Z');
CREATE INDEX idx_devices_user ON devices(user_id);
CREATE INDEX idx_scenarios_user ON scenarios(user_id);
CREATE INDEX idx_notifications_user ON notifications(user_id);
CREATE INDEX idx_telemetry_user_device ON telemetry_points(user_id, device_id);
COMMIT;
