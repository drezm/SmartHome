import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createApp } from "../app.js";
import { resetDatabaseForTests } from "../db/database.js";

async function login(app: ReturnType<typeof createApp>) {
  const response = await request(app)
    .post("/api/auth/login")
    .send({ email: "matvey@example.com", password: "password123" })
    .expect(200);

  return response.body.token as string;
}

describe("home api", () => {
  beforeEach(() => {
    vi.useRealTimers();
    resetDatabaseForTests();
    vi.restoreAllMocks();
  });

  it("lists seeded devices and dashboard summary", async () => {
    const app = createApp();
    const token = await login(app);

    const devices = await request(app).get("/api/devices").set("Authorization", `Bearer ${token}`).expect(200);
    expect(devices.body.devices.length).toBeGreaterThan(0);

    const dashboard = await request(app).get("/api/dashboard").set("Authorization", `Bearer ${token}`).expect(200);
    expect(dashboard.body.stats.totalDevices).toBe(devices.body.devices.length);
  });

  it("classifies only unambiguous seeded sensors as home sensors", async () => {
    const app = createApp();
    const token = await login(app);
    const devices = await request(app).get("/api/devices").set("Authorization", `Bearer ${token}`).expect(200);

    expect(devices.body.devices.find((device: { id: string }) => device.id === "kitchen-temp")).toMatchObject({
      sourceKind: "home_sensor",
      sourceMetric: "temperature"
    });
    expect(devices.body.devices.find((device: { id: string }) => device.id === "hall-motion")).toMatchObject({
      sourceKind: "home_sensor",
      sourceMetric: "motion"
    });
    expect(devices.body.devices.find((device: { id: string }) => device.id === "bedroom-climate")).toMatchObject({
      sourceKind: "manual",
      sourceMetric: null
    });
  });

  it("returns null weather without a saved home location", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const app = createApp();
    const token = await login(app);

    const dashboard = await request(app).get("/api/dashboard").set("Authorization", `Bearer ${token}`).expect(200);

    expect(dashboard.body.weather).toBeNull();
    expect(dashboard.body.stats.temperature).toBeNull();
    expect(dashboard.body.scenarioEvaluation).toMatchObject({
      status: "unknown",
      actualValue: null
    });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("fetches Open-Meteo weather once and reuses fresh cached telemetry", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(openMeteoResponse());
    const app = createApp();
    const token = await login(app);

    await request(app)
      .put("/api/location/browser")
      .set("Authorization", `Bearer ${token}`)
      .send({ latitude: 55.7558, longitude: 37.6173, accuracyMeters: 20, timezone: "Europe/Moscow", label: "Москва" })
      .expect(200);

    const first = await request(app).get("/api/dashboard").set("Authorization", `Bearer ${token}`).expect(200);
    const second = await request(app).get("/api/dashboard").set("Authorization", `Bearer ${token}`).expect(200);
    const telemetry = await request(app).get("/api/telemetry").set("Authorization", `Bearer ${token}`).expect(200);

    expect(first.body.weather).toMatchObject({
      temperature: 18.4,
      humidity: 64,
      apparentTemperature: 17.8,
      precipitation: 0,
      windSpeed: 9.2,
      weatherCode: 2,
      locationLabel: "Москва"
    });
    expect(second.body.weather.temperature).toBe(18.4);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(telemetry.body.telemetry).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          deviceId: expect.stringMatching(/^open-meteo-/),
          source: "public_api",
          externalEventId: expect.stringContaining("open-meteo:")
        })
      ])
    );
  });

  it("returns climate series for presets and custom date ranges", async () => {
    const app = createApp();
    const token = await login(app);

    const preset = await request(app).get("/api/dashboard/climate?range=24h").set("Authorization", `Bearer ${token}`).expect(200);
    expect(preset.body.range).toMatchObject({ preset: "24h" });
    expect(preset.body.temperatureSeries.length).toBeGreaterThan(0);
    expect(preset.body.selectedSensors.temperatureSensorId).toBe("kitchen-temp");
    expect(preset.body.availableSensors.temperature).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: "kitchen-temp", sourceKind: "home_sensor" })])
    );

    const custom = await request(app)
      .get(
        `/api/dashboard/climate?range=24h&from=${encodeURIComponent("2026-01-01T00:00:00.000Z")}&to=${encodeURIComponent(
          "2026-01-01T23:59:59.999Z"
        )}`
      )
      .set("Authorization", `Bearer ${token}`)
      .expect(200);
    expect(custom.body.range).toMatchObject({
      preset: "custom",
      from: "2026-01-01T00:00:00.000Z",
      to: "2026-01-01T23:59:59.999Z"
    });
    expect(custom.body.temperatureSeries).toHaveLength(0);
  });

  it("returns climate points only for the selected sensor", async () => {
    const app = createApp();
    const token = await login(app);

    const created = await request(app)
      .post("/api/devices")
      .set("Authorization", `Bearer ${token}`)
      .send({
        name: "Температура в спальне",
        type: "TEMPERATURE_SENSOR",
        category: "Датчики",
        room: "Спальня",
        enabled: true,
        sourceKind: "home_sensor",
        sourceMetric: "temperature"
      })
      .expect(201);

    const climate = await request(app)
      .get(`/api/dashboard/climate?range=24h&temperatureSensorId=${created.body.device.id}`)
      .set("Authorization", `Bearer ${token}`)
      .expect(200);

    expect(climate.body.selectedSensors.temperatureSensorId).toBe(created.body.device.id);
    expect(climate.body.temperatureSeries).toHaveLength(1);
  });

  it("protects the system weather device from user edits, deletes and manual telemetry", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(openMeteoResponse());
    const app = createApp();
    const token = await login(app);

    await request(app)
      .put("/api/location/browser")
      .set("Authorization", `Bearer ${token}`)
      .send({ latitude: 55.7558, longitude: 37.6173, accuracyMeters: 20, timezone: "Europe/Moscow", label: "Москва" })
      .expect(200);

    await request(app).get("/api/dashboard").set("Authorization", `Bearer ${token}`).expect(200);
    const devices = await request(app).get("/api/devices").set("Authorization", `Bearer ${token}`).expect(200);
    const weatherDevice = devices.body.devices.find((device: { sourceKind: string; isSystem: boolean }) => device.sourceKind === "open_meteo" && device.isSystem);

    expect(weatherDevice).toBeTruthy();
    await request(app).patch(`/api/devices/${weatherDevice.id}`).set("Authorization", `Bearer ${token}`).send({ enabled: false }).expect(400);
    await request(app).delete(`/api/devices/${weatherDevice.id}`).set("Authorization", `Bearer ${token}`).expect(400);
    await request(app)
      .post(`/api/devices/${weatherDevice.id}/telemetry`)
      .set("Authorization", `Bearer ${token}`)
      .send({ kind: "temperature", value: 21, unit: "°C" })
      .expect(400);
  });

  it("creates home sensors with their own telemetry source", async () => {
    const app = createApp();
    const token = await login(app);

    const created = await request(app)
      .post("/api/devices")
      .set("Authorization", `Bearer ${token}`)
      .send({
        name: "Датчик в коридоре",
        type: "TEMPERATURE_SENSOR",
        category: "Датчики",
        room: "Коридор",
        enabled: true,
        sourceKind: "home_sensor",
        sourceMetric: "temperature"
      })
      .expect(201);

    const telemetry = await request(app).get("/api/telemetry").set("Authorization", `Bearer ${token}`).expect(200);

    expect(created.body.device).toMatchObject({
      sourceKind: "home_sensor",
      sourceMetric: "temperature",
      metric: expect.stringContaining("°C")
    });
    expect(telemetry.body.telemetry).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          deviceId: created.body.device.id,
          kind: "temperature",
          source: "home_sensor"
        })
      ])
    );
  });

  it("auto-applies and reverses weather scenarios on dashboard refresh", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-14T10:00:00.000Z"));
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(openMeteoResponse({ time: "2026-05-14T10:00", temperature: 28, humidity: 52 }))
      .mockResolvedValueOnce(openMeteoResponse({ time: "2026-05-14T10:16", temperature: 17, humidity: 52 }));
    const app = createApp();
    const token = await login(app);

    await request(app)
      .put("/api/location/browser")
      .set("Authorization", `Bearer ${token}`)
      .send({ latitude: 55.7558, longitude: 37.6173, accuracyMeters: 20, timezone: "Europe/Moscow", label: "Москва" })
      .expect(200);

    const hotDashboard = await request(app).get("/api/dashboard").set("Authorization", `Bearer ${token}`).expect(200);
    let devices = await request(app).get("/api/devices").set("Authorization", `Bearer ${token}`).expect(200);
    expect(devices.body.devices.find((device: { id: string }) => device.id === "bedroom-climate")).toMatchObject({ enabled: true });
    expect(hotDashboard.body.scenarioEvaluation).toMatchObject({
      status: "matched",
      actualValue: 28,
      targetEnabled: true,
      applied: true
    });

    vi.setSystemTime(new Date("2026-05-14T10:16:00.000Z"));
    const coolDashboard = await request(app).get("/api/dashboard").set("Authorization", `Bearer ${token}`).expect(200);
    devices = await request(app).get("/api/devices").set("Authorization", `Bearer ${token}`).expect(200);
    expect(devices.body.devices.find((device: { id: string }) => device.id === "bedroom-climate")).toMatchObject({ enabled: false });
    expect(coolDashboard.body.scenarioEvaluation).toMatchObject({
      status: "not_matched",
      actualValue: 17,
      targetEnabled: false,
      applied: true
    });
  });

  it("ignores duplicate Open-Meteo external events when stale cache refreshes", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-14T10:00:00.000Z"));
    vi.spyOn(globalThis, "fetch").mockResolvedValue(openMeteoResponse());
    const app = createApp();
    const token = await login(app);

    await request(app)
      .put("/api/location/browser")
      .set("Authorization", `Bearer ${token}`)
      .send({ latitude: 55.7558, longitude: 37.6173, accuracyMeters: 20, timezone: "Europe/Moscow", label: "Москва" })
      .expect(200);

    await request(app).get("/api/dashboard").set("Authorization", `Bearer ${token}`).expect(200);
    vi.setSystemTime(new Date("2026-05-14T10:16:00.000Z"));
    await request(app).get("/api/dashboard").set("Authorization", `Bearer ${token}`).expect(200);

    const telemetry = await request(app).get("/api/telemetry").set("Authorization", `Bearer ${token}`).expect(200);
    const weatherTelemetry = telemetry.body.telemetry.filter((point: { source: string }) => point.source === "public_api");
    expect(weatherTelemetry).toHaveLength(6);
  });

  it("keeps dashboard available when Open-Meteo is unavailable", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({ ok: false, status: 503, json: async () => ({}) } as unknown as Response);
    const app = createApp();
    const token = await login(app);

    await request(app)
      .put("/api/location/browser")
      .set("Authorization", `Bearer ${token}`)
      .send({ latitude: 55.7558, longitude: 37.6173, accuracyMeters: 20, timezone: "Europe/Moscow", label: "Москва" })
      .expect(200);

    const dashboard = await request(app).get("/api/dashboard").set("Authorization", `Bearer ${token}`).expect(200);
    expect(dashboard.body.weather).toBeNull();
    const devices = await request(app).get("/api/devices").set("Authorization", `Bearer ${token}`).expect(200);
    expect(devices.body.devices.find((device: { id: string }) => device.id === "bedroom-climate")).toMatchObject({ enabled: false });
  });

  it("creates a scenario", async () => {
    const app = createApp();
    const token = await login(app);

    const response = await request(app)
      .post("/api/scenarios")
      .set("Authorization", `Bearer ${token}`)
      .send({
        title: "Проверка",
        sourceDeviceId: "kitchen-temp",
        sourceDeviceName: "Датчик температуры",
        sourceMetric: "temperature",
        metric: "Температура",
        operator: ">",
        value: 24,
        unit: "°C",
        targetDeviceId: "bedroom-climate",
        targetDeviceName: "Кондиционер",
        command: "Включить"
      })
      .expect(201);

    expect(response.body.scenario.condition).toContain("24");

    const updated = await request(app)
      .patch(`/api/scenarios/${response.body.scenario.id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({
        title: "Проверка обновлена",
        sourceDeviceId: "hall-motion",
        sourceDeviceName: "Датчик движения",
        sourceMetric: "motion",
        metric: "Движение",
        operator: "=",
        value: 1,
        unit: null,
        targetDeviceId: "bedroom-humidity",
        targetDeviceName: "Увлажнитель",
        command: "Выключить",
        active: false
      })
      .expect(200);

    expect(updated.body.scenario).toMatchObject({
      title: "Проверка обновлена",
      sourceDeviceId: "hall-motion",
      sourceDeviceName: "Датчик движения",
      sourceMetric: "motion",
      metric: "Движение",
      operator: "=",
      value: 1,
      unit: null,
      targetDeviceId: "bedroom-humidity",
      targetDeviceName: "Увлажнитель",
      command: "Выключить",
      active: false
    });

    await request(app).delete(`/api/scenarios/${response.body.scenario.id}`).set("Authorization", `Bearer ${token}`).expect(200);
  });

  it("rejects metrics that are not supported by the selected source sensor", async () => {
    const app = createApp();
    const token = await login(app);

    await request(app)
      .post("/api/scenarios")
      .set("Authorization", `Bearer ${token}`)
      .send({
        title: "Некорректный источник",
        sourceDeviceId: "kitchen-temp",
        sourceDeviceName: "Датчик температуры",
        sourceMetric: "humidity",
        metric: "Влажность",
        operator: ">",
        value: 55,
        unit: "%",
        targetDeviceId: "bedroom-climate",
        targetDeviceName: "Кондиционер",
        command: "Включить"
      })
      .expect(400);
  });

  it("runs a manual scenario with multiple actions", async () => {
    const app = createApp();
    const token = await login(app);

    const created = await request(app)
      .post("/api/scenarios")
      .set("Authorization", `Bearer ${token}`)
      .send({
        title: "Кино",
        triggerType: "manual",
        favorite: true,
        metric: "Выключатель",
        operator: "=",
        value: 1,
        unit: null,
        targetDeviceId: null,
        targetDeviceName: "Несколько устройств",
        command: "Выключить",
        actions: [
          { targetDeviceId: "living-light", targetDeviceName: "Лампа в гостиной", command: "Выключить", orderIndex: 0 },
          { targetDeviceId: "bedroom-climate", targetDeviceName: "Кондиционер", command: "Включить", orderIndex: 1 }
        ]
      })
      .expect(201);

    await request(app).post(`/api/scenarios/${created.body.scenario.id}/run`).set("Authorization", `Bearer ${token}`).expect(200);
    const devices = await request(app).get("/api/devices").set("Authorization", `Bearer ${token}`).expect(200);
    expect(devices.body.devices.find((device: { id: string }) => device.id === "living-light")).toMatchObject({ enabled: false });
    expect(devices.body.devices.find((device: { id: string }) => device.id === "bedroom-climate")).toMatchObject({ enabled: true });
  });

  it("runs daily schedule scenarios once per local day", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-14T04:30:00.000Z"));
    const app = createApp();
    const token = await login(app);

    const created = await request(app)
      .post("/api/scenarios")
      .set("Authorization", `Bearer ${token}`)
      .send({
        title: "Утренний запуск",
        automationSource: "schedule",
        scheduleTime: "07:30",
        metric: "Выключатель",
        operator: "=",
        value: 1,
        unit: null,
        targetDeviceId: "office-plug",
        targetDeviceName: "Умная розетка",
        command: "Включить"
      })
      .expect(201);

    expect(created.body.scenario).toMatchObject({
      automationSource: "schedule",
      scheduleTime: "07:30",
      scheduleTimezone: "Europe/Moscow"
    });

    await request(app).get("/api/dashboard").set("Authorization", `Bearer ${token}`).expect(200);
    await request(app).get("/api/dashboard").set("Authorization", `Bearer ${token}`).expect(200);

    const devices = await request(app).get("/api/devices").set("Authorization", `Bearer ${token}`).expect(200);
    const scenarios = await request(app).get("/api/scenarios").set("Authorization", `Bearer ${token}`).expect(200);
    const notifications = await request(app).get("/api/notifications").set("Authorization", `Bearer ${token}`).expect(200);

    expect(devices.body.devices.find((device: { id: string }) => device.id === "office-plug")).toMatchObject({ enabled: true });
    expect(scenarios.body.scenarios.find((scenario: { title: string }) => scenario.title === "Утренний запуск")).toMatchObject({
      lastScheduleRunAt: expect.any(String),
      lastEvaluation: expect.objectContaining({
        status: "not_matched"
      })
    });
    expect(notifications.body.notifications.filter((item: { title: string }) => item.title.includes("Утренний запуск"))).toHaveLength(1);
  });

  it("uses home timezone for schedule scenarios", async () => {
    const app = createApp();
    const token = await login(app);

    await request(app)
      .put("/api/location/browser")
      .set("Authorization", `Bearer ${token}`)
      .send({ latitude: 51.5072, longitude: -0.1276, accuracyMeters: 20, timezone: "Europe/London", label: "Лондон" })
      .expect(200);

    const created = await request(app)
      .post("/api/scenarios")
      .set("Authorization", `Bearer ${token}`)
      .send({
        title: "Лондонское расписание",
        automationSource: "schedule",
        scheduleTime: "21:15",
        metric: "Выключатель",
        operator: "=",
        value: 1,
        unit: null,
        targetDeviceId: "living-light",
        targetDeviceName: "Лампа в гостиной",
        command: "Выключить"
      })
      .expect(201);

    expect(created.body.scenario.scheduleTimezone).toBe("Europe/London");
  });

  it("exposes five free reports and ten reports for premium users", async () => {
    const app = createApp();
    const token = await login(app);
    const devices = await request(app).get("/api/devices").set("Authorization", `Bearer ${token}`).expect(200);
    const manualDevice = devices.body.devices.find((device: { sourceKind: string }) => device.sourceKind === "manual");
    const sensor = devices.body.devices.find((device: { sourceKind: string }) => device.sourceKind !== "manual");
    const rooms = Array.from(new Set(devices.body.devices.map((device: { room: string }) => device.room)));
    expect(rooms.length).toBeGreaterThan(1);

    const freeCatalog = await request(app).get("/api/reports/catalog").set("Authorization", `Bearer ${token}`).expect(200);
    expect(freeCatalog.body.reports.filter((report: { available: boolean }) => report.available)).toHaveLength(5);
    await request(app).get("/api/reports/device_detail").set("Authorization", `Bearer ${token}`).expect(400);
    const freeReport = await request(app).get("/api/reports/home_summary?range=7d").set("Authorization", `Bearer ${token}`).expect(200);
    expect(freeReport.body.report.summary).toContain("7 дней");
    expect(freeReport.body.report.blocks.map((block: { type: string }) => block.type)).toContain("metrics");
    const customReport = await request(app)
      .get(
        `/api/reports/home_summary?range=7d&from=${encodeURIComponent("2026-01-01T00:00:00.000Z")}&to=${encodeURIComponent(
          "2026-01-02T23:59:59.999Z"
        )}`
      )
      .set("Authorization", `Bearer ${token}`)
      .expect(200);
    expect(customReport.body.report.range).toMatchObject({
      preset: "custom",
      from: "2026-01-01T00:00:00.000Z",
      to: "2026-01-02T23:59:59.999Z"
    });

    const checkout = await request(app)
      .post("/api/subscription/checkout")
      .set("Authorization", `Bearer ${token}`)
      .send({
        cardholderName: "Matvey Sablukov",
        cardNumber: "4111111111111111",
        expires: "12/30",
        cvc: "123",
        paymentEmail: "matvey@example.com"
      })
      .expect(200);

    expect(checkout.body.subscription.isPremium).toBe(true);
    expect(checkout.body.subscription.paymentMockLast4).toBe("1111");

    const premiumCatalog = await request(app).get("/api/reports/catalog").set("Authorization", `Bearer ${token}`).expect(200);
    expect(premiumCatalog.body.reports.filter((report: { available: boolean }) => report.available)).toHaveLength(10);
    const report = await request(app)
      .get(`/api/reports/device_detail?range=7d&deviceId=${manualDevice.id}`)
      .set("Authorization", `Bearer ${token}`)
      .expect(200);
    expect(report.body.report.summary).toContain(manualDevice.name);
    const sensorReport = await request(app)
      .get(`/api/reports/sensor_detail?range=7d&sensorId=${sensor.id}`)
      .set("Authorization", `Bearer ${token}`)
      .expect(200);
    expect(sensorReport.body.report.summary).toContain(sensor.name);
    expect(sensorReport.body.report.blocks).not.toEqual(report.body.report.blocks);
    await request(app)
      .get(`/api/reports/room_comparison?range=7d&roomA=${encodeURIComponent(String(rooms[0]))}&roomB=${encodeURIComponent(String(rooms[1]))}`)
      .set("Authorization", `Bearer ${token}`)
      .expect(200);
    await request(app)
      .get(`/api/reports/home_climate.pdf?range=7d`)
      .set("Authorization", `Bearer ${token}`)
      .expect(200)
      .expect("Content-Type", /application\/pdf/);

    const cancelled = await request(app).post("/api/subscription/cancel").set("Authorization", `Bearer ${token}`).expect(200);
    expect(cancelled.body.subscription.status).toBe("cancelled");
    expect(cancelled.body.subscription.isPremium).toBe(true);
    expect(cancelled.body.subscription.cancelledAt).toEqual(expect.any(String));

    const reportAfterCancel = await request(app)
      .get(`/api/reports/device_detail?range=7d&deviceId=${manualDevice.id}`)
      .set("Authorization", `Bearer ${token}`)
      .expect(200);
    expect(reportAfterCancel.body.report.summary).toContain(manualDevice.name);

    const renewed = await request(app)
      .post("/api/subscription/checkout")
      .set("Authorization", `Bearer ${token}`)
      .send({
        cardholderName: "Matvey Sablukov",
        cardNumber: "4111111111111111",
        expires: "12/30",
        cvc: "123",
        paymentEmail: "matvey@example.com"
      })
      .expect(200);
    expect(renewed.body.subscription.status).toBe("active");
    expect(renewed.body.subscription.cancelledAt).toBeNull();

    const telegram = await request(app)
      .put("/api/integrations/telegram")
      .set("Authorization", `Bearer ${token}`)
      .send({ botToken: "123456:telegram-token", chatId: "100500" })
      .expect(200);
    expect(telegram.body.telegram.connected).toBe(true);
    expect(telegram.body.telegram.hasBotToken).toBe(true);
  });

  it("rejects invalid card data on subscription checkout", async () => {
    const app = createApp();
    const token = await login(app);

    await request(app)
      .post("/api/subscription/checkout")
      .set("Authorization", `Bearer ${token}`)
      .send({
        cardholderName: "Matvey Sablukov",
        cardNumber: "4111 1111 1111 1112",
        expires: "01/20",
        cvc: "12a",
        paymentEmail: "matvey@example.com"
      })
      .expect(400);
  });

  it("returns only thematic smart-home news for free and premium users", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      text: async () => `
        <rss><channel><title>IT News</title>
          <item><title>Новая технология</title><link>https://example.com/news</link><pubDate>Tue, 21 Apr 2026 10:00:00 GMT</pubDate></item>
          <item><title>Умный дом на Zigbee</title><link>https://example.com/smart-home</link><category>Умный дом</category><pubDate>Tue, 21 Apr 2026 11:00:00 GMT</pubDate></item>
          <item><title>Новый контроллер</title><link>https://example.com/controller</link><description>MQTT и датчики для автоматизации дома</description><pubDate>Tue, 21 Apr 2026 12:00:00 GMT</pubDate></item>
        </channel></rss>
      `
    } as Response);

    const app = createApp();
    const token = await login(app);
    const freeResponse = await request(app).get("/api/news").set("Authorization", `Bearer ${token}`).expect(200);
    await request(app)
      .post("/api/subscription/checkout")
      .set("Authorization", `Bearer ${token}`)
      .send({
        cardholderName: "Matvey Sablukov",
        cardNumber: "4111111111111111",
        expires: "12/30",
        cvc: "123",
        paymentEmail: "matvey@example.com"
      })
      .expect(200);
    const premiumResponse = await request(app).get("/api/news").set("Authorization", `Bearer ${token}`).expect(200);

    expect(freeResponse.body.news).toHaveLength(2);
    expect(freeResponse.body.news[0]).toMatchObject({
      title: "Новый контроллер",
      source: "IT News",
      url: "https://example.com/controller"
    });
    expect(freeResponse.body.news[1]).toMatchObject({
      title: "Умный дом на Zigbee",
      source: "IT News",
      url: "https://example.com/smart-home"
    });
    expect(premiumResponse.body.news[0]).toMatchObject({
      title: "Новый контроллер",
      source: "IT News",
      url: "https://example.com/controller"
    });
  });

  it("returns an empty news list when feeds have no thematic items", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      text: async () => `
        <rss><channel><title>Все публикации подряд</title>
          <item><title>Как выбрать книгу по Qt</title><link>https://example.com/qt</link><pubDate>Tue, 21 Apr 2026 10:00:00 GMT</pubDate></item>
        </channel></rss>
      `
    } as Response);

    const app = createApp();
    const token = await login(app);
    const response = await request(app).get("/api/news").set("Authorization", `Bearer ${token}`).expect(200);

    expect(response.body.news).toEqual([]);
  });
});

function openMeteoResponse(input: { time?: string; temperature?: number; humidity?: number } = {}) {
  return {
    ok: true,
    json: async () => ({
      current: {
        time: input.time ?? "2026-05-14T13:00",
        temperature_2m: input.temperature ?? 18.4,
        relative_humidity_2m: input.humidity ?? 64,
        apparent_temperature: 17.8,
        precipitation: 0,
        weather_code: 2,
        wind_speed_10m: 9.2,
        shortwave_radiation: 180
      }
    })
  } as unknown as Response;
}
