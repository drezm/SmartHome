import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
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
  });
});
