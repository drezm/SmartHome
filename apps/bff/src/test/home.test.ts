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

  it("creates a scenario", async () => {
    const app = createApp();
    const token = await login(app);

    const response = await request(app)
      .post("/api/scenarios")
      .set("Authorization", `Bearer ${token}`)
      .send({
        title: "Проверка",
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
        metric: "Влажность",
        operator: "<",
        value: 40,
        unit: "%",
        targetDeviceId: "bedroom-humidity",
        targetDeviceName: "Увлажнитель",
        command: "Выключить",
        active: false
      })
      .expect(200);

    expect(updated.body.scenario).toMatchObject({
      title: "Проверка обновлена",
      metric: "Влажность",
      operator: "<",
      value: 40,
      unit: "%",
      targetDeviceId: "bedroom-humidity",
      targetDeviceName: "Увлажнитель",
      command: "Выключить",
      active: false
    });

    await request(app).delete(`/api/scenarios/${response.body.scenario.id}`).set("Authorization", `Bearer ${token}`).expect(200);
  });

  it("activates premium subscription and unlocks reports and telegram settings", async () => {
    const app = createApp();
    const token = await login(app);

    await request(app).get("/api/reports/summary").set("Authorization", `Bearer ${token}`).expect(400);

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

    const report = await request(app).get("/api/reports/summary?range=7d").set("Authorization", `Bearer ${token}`).expect(200);
    expect(report.body.report.summary).toContain("7 дней");

    const cancelled = await request(app).post("/api/subscription/cancel").set("Authorization", `Bearer ${token}`).expect(200);
    expect(cancelled.body.subscription.status).toBe("cancelled");
    expect(cancelled.body.subscription.isPremium).toBe(true);
    expect(cancelled.body.subscription.cancelledAt).toEqual(expect.any(String));

    const reportAfterCancel = await request(app).get("/api/reports/summary?range=7d").set("Authorization", `Bearer ${token}`).expect(200);
    expect(reportAfterCancel.body.report.summary).toContain("7 дней");

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

  it("returns normalized IT news and falls back safely", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      text: async () => `
        <rss><channel><title>IT News</title>
          <item><title>Новая технология</title><link>https://example.com/news</link><pubDate>Tue, 21 Apr 2026 10:00:00 GMT</pubDate></item>
        </channel></rss>
      `
    } as Response);

    const app = createApp();
    const token = await login(app);
    const response = await request(app).get("/api/news/it").set("Authorization", `Bearer ${token}`).expect(200);

    expect(response.body.news[0]).toMatchObject({
      title: "Новая технология",
      source: "IT News",
      url: "https://example.com/news"
    });
  });
});
