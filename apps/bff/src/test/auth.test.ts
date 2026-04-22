import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { AuthService } from "../services/authService.js";
import { createApp } from "../app.js";
import { resetDatabaseForTests } from "../db/database.js";
import { UserRepository } from "../repositories/userRepository.js";

describe("auth api", () => {
  beforeEach(() => {
    resetDatabaseForTests();
  });

  it("registers a user and returns current profile", async () => {
    const app = createApp();

    const registerResponse = await request(app)
      .post("/api/auth/register")
      .send({ name: "Test User", email: "test@example.com", password: "secret123" })
      .expect(201);

    expect(registerResponse.body.user.email).toBe("test@example.com");
    expect(registerResponse.body.token).toEqual(expect.any(String));

    const meResponse = await request(app)
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${registerResponse.body.token}`)
      .expect(200);

    expect(meResponse.body.user.name).toBe("Test User");

    const devicesResponse = await request(app).get("/api/devices").set("Authorization", `Bearer ${registerResponse.body.token}`).expect(200);
    expect(devicesResponse.body.devices).toHaveLength(0);

    const dashboardResponse = await request(app).get("/api/dashboard").set("Authorization", `Bearer ${registerResponse.body.token}`).expect(200);
    expect(dashboardResponse.body.stats).toMatchObject({
      temperature: null,
      onlineDevices: 0,
      totalDevices: 0,
      eventsToday: 0
    });
    expect(dashboardResponse.body.temperatureSeries).toHaveLength(0);
  });

  it("logs into seeded demo account", async () => {
    const app = createApp();

    const response = await request(app)
      .post("/api/auth/login")
      .send({ email: "matvey@example.com", password: "password123" })
      .expect(200);

    expect(response.body.user.email).toBe("matvey@example.com");
  });

  it("creates a password reset token and changes password", async () => {
    const db = resetDatabaseForTests();
    let resetCode = "";
    const auth = new AuthService(new UserRepository(db), {
      sendPasswordResetCode: async (_user, code) => {
        resetCode = code;
      },
      isConfigured: () => true
    });

    await auth.forgotPassword({ email: "matvey@example.com" });
    expect(resetCode).toMatch(/^\d{6}$/);
    await expect(auth.verifyResetCode({ email: "matvey@example.com", code: resetCode })).resolves.toEqual({ valid: true });
    await expect(auth.resetPassword({ email: "matvey@example.com", code: "000000", password: "new-password123" })).rejects.toThrow("Код восстановления");

    await auth.resetPassword({ email: "matvey@example.com", code: resetCode, password: "new-password123" });
    await expect(auth.login({ email: "matvey@example.com", password: "new-password123" })).resolves.toMatchObject({
      user: { email: "matvey@example.com" }
    });
  });
});
