import { env } from "../config/env.js";
import type { Device, DeviceCategory, DeviceType, HomeLocation, OpenMeteoMetric, TelemetryPoint, WeatherSnapshot } from "../domain/types.js";
import type { HomeStore } from "../repositories/contracts.js";

const LEGACY_WEATHER_DEVICE_PREFIX = "weather-outdoor-";
const OPEN_METEO_DEVICE_PREFIX = "open-meteo-";

type OpenMeteoCurrent = {
  time?: unknown;
  temperature_2m?: unknown;
  relative_humidity_2m?: unknown;
  apparent_temperature?: unknown;
  precipitation?: unknown;
  weather_code?: unknown;
  wind_speed_10m?: unknown;
  shortwave_radiation?: unknown;
};

type OpenMeteoResponse = {
  current?: OpenMeteoCurrent;
};

type OpenMeteoSensorDefinition = {
  metric: OpenMeteoMetric;
  kind: string;
  name: string;
  type: DeviceType;
  category: DeviceCategory;
  room: string;
  unit: string | null;
  default: boolean;
};

export const OPEN_METEO_SENSOR_DEFINITIONS: OpenMeteoSensorDefinition[] = [
  {
    metric: "temperature_2m",
    kind: "temperature",
    name: "Температура снаружи",
    type: "TEMPERATURE_SENSOR",
    category: "Датчики",
    room: "Улица",
    unit: "°C",
    default: true
  },
  {
    metric: "relative_humidity_2m",
    kind: "humidity",
    name: "Влажность снаружи",
    type: "CLIMATE_SENSOR",
    category: "Климат",
    room: "Улица",
    unit: "%",
    default: true
  },
  {
    metric: "precipitation",
    kind: "precipitation",
    name: "Осадки снаружи",
    type: "CLIMATE_SENSOR",
    category: "Климат",
    room: "Улица",
    unit: "мм",
    default: true
  },
  {
    metric: "wind_speed_10m",
    kind: "wind_speed",
    name: "Ветер снаружи",
    type: "CLIMATE_SENSOR",
    category: "Климат",
    room: "Улица",
    unit: "км/ч",
    default: true
  },
  {
    metric: "shortwave_radiation",
    kind: "illuminance",
    name: "Освещенность снаружи",
    type: "LIGHT_SENSOR",
    category: "Датчики",
    room: "Улица",
    unit: "Вт/м²",
    default: false
  }
];

export class WeatherService {
  constructor(
    private readonly home: HomeStore,
    private readonly fetcher: typeof fetch = fetch,
    private readonly apiUrl = env.WEATHER_API_URL,
    private readonly cacheTtlMs = env.WEATHER_CACHE_TTL_MS
  ) {}

  async getCurrentWeather(userId: string): Promise<WeatherSnapshot | null> {
    const location = await this.home.getHomeLocation(userId);
    if (!location) {
      return null;
    }

    const sensors = await this.ensureDefaultSensors(userId);
    const cached = buildCachedSnapshot(await this.home.listLatestTelemetry(userId), sensors, location);
    if (cached && Date.now() - new Date(cached.updatedAt).getTime() < this.cacheTtlMs) {
      return cached;
    }

    try {
      const fresh = await this.fetchWeather(location);
      await this.persistWeather(userId, await this.listOpenMeteoSensors(userId), fresh);
      return fresh;
    } catch {
      return cached;
    }
  }

  async ensureOpenMeteoSensor(userId: string, metric: OpenMeteoMetric) {
    const definition = getOpenMeteoDefinition(metric);
    const id = buildOpenMeteoDeviceId(metric, userId);
    const existing = await this.home.getDevice(userId, id);
    if (existing) {
      return existing;
    }

    return this.home.createDevice(userId, {
      id,
      name: definition.name,
      type: definition.type,
      category: definition.category,
      room: definition.room,
      enabled: true,
      sourceKind: "open_meteo",
      sourceMetric: metric,
      isSystem: true
    });
  }

  private async ensureDefaultSensors(userId: string) {
    return Promise.all(
      OPEN_METEO_SENSOR_DEFINITIONS.filter((definition) => definition.default).map((definition) => this.ensureOpenMeteoSensor(userId, definition.metric))
    );
  }

  private async listOpenMeteoSensors(userId: string) {
    const devices = await this.home.listDevices(userId);
    return devices.filter((device) => device.sourceKind === "open_meteo" && device.sourceMetric !== null && !isLegacyWeatherDeviceId(device.id));
  }

  private async fetchWeather(location: HomeLocation): Promise<WeatherSnapshot> {
    const url = new URL(this.apiUrl);
    url.searchParams.set("latitude", String(location.latitude));
    url.searchParams.set("longitude", String(location.longitude));
    url.searchParams.set(
      "current",
      "temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m,shortwave_radiation"
    );
    url.searchParams.set("wind_speed_unit", "kmh");

    const response = await this.fetcher(url);
    if (!response.ok) {
      throw new Error(`Open-Meteo returned ${response.status}`);
    }

    const payload = (await response.json()) as OpenMeteoResponse;
    const current = payload.current;
    if (!current) {
      throw new Error("Open-Meteo response has no current weather");
    }

    return {
      temperature: readNumber(current.temperature_2m, "temperature_2m"),
      humidity: readNumber(current.relative_humidity_2m, "relative_humidity_2m"),
      apparentTemperature: readNumber(current.apparent_temperature, "apparent_temperature"),
      precipitation: readNumber(current.precipitation, "precipitation"),
      windSpeed: readNumber(current.wind_speed_10m, "wind_speed_10m"),
      weatherCode: readNumber(current.weather_code, "weather_code"),
      shortwaveRadiation: readOptionalNumber(current.shortwave_radiation),
      observedAt: typeof current.time === "string" ? current.time : new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      locationLabel: location.label ?? formatLocationLabel(location)
    };
  }

  private async persistWeather(userId: string, sensors: Device[], snapshot: WeatherSnapshot) {
    const readings = sensors.flatMap((sensor) => buildSensorReadings(sensor, snapshot));

    for (const reading of readings) {
      await this.home.createTelemetry(userId, {
        deviceId: reading.deviceId,
        kind: reading.kind,
        value: reading.value,
        unit: reading.unit,
        source: "public_api",
        externalObservedAt: snapshot.observedAt,
        externalEventId: `open-meteo:${userId}:${snapshot.observedAt}:${reading.kind}`
      });
    }
  }
}

export function buildOpenMeteoDeviceId(metric: OpenMeteoMetric, userId: string) {
  return `${OPEN_METEO_DEVICE_PREFIX}${metric}-${userId}`;
}

export function buildLegacyWeatherDeviceId(userId: string) {
  return `${LEGACY_WEATHER_DEVICE_PREFIX}${userId}`;
}

export function isLegacyWeatherDeviceId(id: string) {
  return id.startsWith(LEGACY_WEATHER_DEVICE_PREFIX);
}

export function isSystemDeviceId(id: string) {
  return isLegacyWeatherDeviceId(id) || id.startsWith(OPEN_METEO_DEVICE_PREFIX);
}

export function getOpenMeteoDefinition(metric: OpenMeteoMetric) {
  const definition = OPEN_METEO_SENSOR_DEFINITIONS.find((item) => item.metric === metric);
  if (!definition) {
    throw new Error(`Unsupported Open-Meteo metric: ${metric}`);
  }
  return definition;
}

export function isOpenMeteoMetric(value: string | null | undefined): value is OpenMeteoMetric {
  return OPEN_METEO_SENSOR_DEFINITIONS.some((definition) => definition.metric === value);
}

function buildSensorReadings(sensor: Device, snapshot: WeatherSnapshot) {
  if (!sensor.sourceMetric) {
    return [];
  }

  if (sensor.sourceMetric === "temperature_2m") {
    return [
      { deviceId: sensor.id, kind: "apparent_temperature", value: snapshot.apparentTemperature, unit: "°C" },
      { deviceId: sensor.id, kind: "weather_code", value: snapshot.weatherCode, unit: null },
      { deviceId: sensor.id, kind: "temperature", value: snapshot.temperature, unit: "°C" }
    ];
  }

  if (sensor.sourceMetric === "relative_humidity_2m") {
    return [{ deviceId: sensor.id, kind: "humidity", value: snapshot.humidity, unit: "%" }];
  }

  if (sensor.sourceMetric === "precipitation") {
    return [{ deviceId: sensor.id, kind: "precipitation", value: snapshot.precipitation, unit: "мм" }];
  }

  if (sensor.sourceMetric === "wind_speed_10m") {
    return [{ deviceId: sensor.id, kind: "wind_speed", value: snapshot.windSpeed, unit: "км/ч" }];
  }

  if (sensor.sourceMetric === "shortwave_radiation" && snapshot.shortwaveRadiation !== null) {
    return [{ deviceId: sensor.id, kind: "illuminance", value: snapshot.shortwaveRadiation, unit: "Вт/м²" }];
  }

  return [];
}

function buildCachedSnapshot(telemetry: TelemetryPoint[], sensors: Device[], location: HomeLocation): WeatherSnapshot | null {
  const byMetric = new Map(sensors.map((sensor) => [sensor.sourceMetric, sensor]));
  const temperatureDevice = byMetric.get("temperature_2m");
  const humidityDevice = byMetric.get("relative_humidity_2m");
  const precipitationDevice = byMetric.get("precipitation");
  const windDevice = byMetric.get("wind_speed_10m");
  const lightDevice = byMetric.get("shortwave_radiation");

  if (!temperatureDevice || !humidityDevice || !precipitationDevice || !windDevice) {
    return null;
  }

  const temperature = latest(telemetry, temperatureDevice.id, "temperature");
  const humidity = latest(telemetry, humidityDevice.id, "humidity");
  const apparentTemperature = latest(telemetry, temperatureDevice.id, "apparent_temperature");
  const precipitation = latest(telemetry, precipitationDevice.id, "precipitation");
  const windSpeed = latest(telemetry, windDevice.id, "wind_speed");
  const weatherCode = latest(telemetry, temperatureDevice.id, "weather_code");
  const shortwaveRadiation = lightDevice ? latest(telemetry, lightDevice.id, "illuminance") : null;

  if (!temperature || !humidity || !apparentTemperature || !precipitation || !windSpeed || !weatherCode) {
    return null;
  }
  if (lightDevice && !shortwaveRadiation) {
    return null;
  }

  return {
    temperature: temperature.value,
    humidity: humidity.value,
    apparentTemperature: apparentTemperature.value,
    precipitation: precipitation.value,
    windSpeed: windSpeed.value,
    weatherCode: weatherCode.value,
    shortwaveRadiation: shortwaveRadiation?.value ?? null,
    observedAt: temperature.externalObservedAt ?? temperature.createdAt,
    updatedAt: temperature.createdAt,
    locationLabel: location.label ?? formatLocationLabel(location)
  };
}

function latest(points: TelemetryPoint[], deviceId: string, kind: string) {
  return points
    .filter((point) => point.deviceId === deviceId && point.kind === kind && point.source === "public_api")
    .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime())[0] ?? null;
}

function readNumber(value: unknown, field: string) {
  const numberValue = Number(value);
  if (!Number.isFinite(numberValue)) {
    throw new Error(`Open-Meteo field ${field} is not numeric`);
  }

  return numberValue;
}

function readOptionalNumber(value: unknown) {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : null;
}

function formatLocationLabel(location: HomeLocation) {
  return `${location.latitude.toFixed(4)}, ${location.longitude.toFixed(4)}`;
}
