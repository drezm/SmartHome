import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../app.js";
import { resetDatabaseForTests } from "../db/database.js";

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
  });

  it("logs into seeded demo account", async () => {
    const app = createApp();

    const response = await request(app)
      .post("/api/auth/login")
      .send({ email: "matvey@example.com", password: "password123" })
      .expect(200);

    expect(response.body.user.email).toBe("matvey@example.com");
  });
});
