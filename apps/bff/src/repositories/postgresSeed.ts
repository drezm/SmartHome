import { randomUUID } from "node:crypto";
import type { PoolClient } from "pg";

export async function seedHomeForUserPostgres(db: PoolClient, userId: string) {
  const now = new Date().toISOString();
  const devices = {
    livingLight: randomUUID(),
    bedroomClimate: randomUUID(),
    kitchenTemp: randomUUID(),
    officePlug: randomUUID(),
    bedroomHumidity: randomUUID(),
    hallMotion: randomUUID()
  };

  const deviceRows = [
    [devices.livingLight, "Лампа в гостиной", "LIGHT_SENSOR", "Освещение", "Гостиная", 1, 1, null],
    [devices.bedroomClimate, "Кондиционер", "CLIMATE_SENSOR", "Климат", "Спальня", 1, 0, "24°C"],
    [devices.kitchenTemp, "Датчик температуры", "TEMPERATURE_SENSOR", "Датчики", "Кухня", 1, 1, "26°C"],
    [devices.officePlug, "Умная розетка", "SWITCH_SENSOR", "Розетки", "Кабинет", 0, 0, null],
    [devices.bedroomHumidity, "Увлажнитель", "CLIMATE_SENSOR", "Климат", "Спальня", 1, 1, "45%"],
    [devices.hallMotion, "Датчик движения", "MOTION_SENSOR", "Безопасность", "Коридор", 1, 1, null]
  ];

  for (const device of deviceRows) {
    await db.query(
      `INSERT INTO devices
       (id, user_id, name, type, category, room, online, enabled, metric, last_seen, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      [device[0], userId, device[1], device[2], device[3], device[4], device[5], device[6], device[7], now, now]
    );
  }

  const scenarioRows = [
    [randomUUID(), "Автоохлаждение", "Температура", ">", 25, "°C", devices.bedroomClimate, "Кондиционер", "Включить", 1],
    [randomUUID(), "Ночной режим", "Выключатель", "=", 1, null, devices.livingLight, "Лампа в гостиной", "Выключить", 0],
    [randomUUID(), "Уютный вечер", "Движение", "=", 1, null, devices.livingLight, "Лампа в гостиной", "Включить", 1]
  ];

  for (const scenario of scenarioRows) {
    await db.query(
      `INSERT INTO scenarios
       (id, user_id, title, metric, operator, value, unit, target_device_id, target_device_name, command, active, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
      [scenario[0], userId, scenario[1], scenario[2], scenario[3], scenario[4], scenario[5], scenario[6], scenario[7], scenario[8], scenario[9], now]
    );
  }

  const notificationRows = [
    ["Температура выше 25°C в гостиной", "temperature", 1],
    ["Движение в коридоре", "motion", 1],
    ["Свет на кухне включен", "device", 0]
  ];

  for (const notification of notificationRows) {
    await db.query("INSERT INTO notifications (id, user_id, title, type, unread, created_at) VALUES ($1, $2, $3, $4, $5, $6)", [
      randomUUID(),
      userId,
      notification[0],
      notification[1],
      notification[2],
      now
    ]);
  }

  const hours = [23, 21, 18, 15, 12, 9, 6, 3];
  const values = [22, 21, 20, 23, 26, 27, 25, 23];
  for (const [index, hoursAgo] of hours.entries()) {
    const date = new Date(Date.now() - hoursAgo * 60 * 60 * 1000).toISOString();
    await db.query("INSERT INTO telemetry_points (id, user_id, device_id, kind, value, unit, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7)", [
      randomUUID(),
      userId,
      devices.kitchenTemp,
      "temperature",
      values[index],
      "°C",
      date
    ]);
  }
}
