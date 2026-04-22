import { beforeEach, describe, expect, it, vi } from "vitest";

const mailer = vi.hoisted(() => {
  const sendMail = vi.fn();
  return {
    sendMail,
    createTransport: vi.fn(() => ({ sendMail }))
  };
});

vi.mock("nodemailer", () => ({
  default: {
    createTransport: mailer.createTransport
  }
}));

import { EmailService } from "../services/emailService.js";
import { resolveSmtpConfig } from "../services/smtpConfig.js";

describe("smtp config", () => {
  beforeEach(() => {
    mailer.createTransport.mockClear();
    mailer.sendMail.mockClear();
  });

  it.each([
    ["sender@gmail.com", "smtp.gmail.com", 587, false],
    ["sender@googlemail.com", "smtp.gmail.com", 587, false],
    ["sender@yandex.ru", "smtp.yandex.com", 465, true],
    ["sender@ya.ru", "smtp.yandex.com", 465, true],
    ["sender@mail.ru", "smtp.mail.ru", 465, true],
    ["sender@bk.ru", "smtp.mail.ru", 465, true],
    ["sender@icloud.com", "smtp.mail.me.com", 587, false],
    ["sender@me.com", "smtp.mail.me.com", 587, false]
  ])("resolves auto SMTP for %s", (user, host, port, secure) => {
    const smtp = resolveSmtpConfig({ user, password: "app-password" });

    expect(smtp.transport).toMatchObject({
      host,
      port,
      secure,
      auth: { user, pass: "app-password" }
    });
    expect(smtp.from).toBe(`SmartHome <${user}>`);
  });

  it("uses custom SMTP when host is configured", () => {
    const smtp = resolveSmtpConfig({
      host: "smtp.example.com",
      port: 2525,
      secure: false,
      user: "sender@example.com",
      password: "app-password",
      from: "SmartHome <sender@example.com>"
    });

    expect(smtp.provider).toBe("custom");
    expect(smtp.transport).toMatchObject({
      host: "smtp.example.com",
      port: 2525,
      secure: false
    });
  });

  it("rejects unsupported domains without custom SMTP", () => {
    expect(() => resolveSmtpConfig({ user: "sender@example.com", password: "app-password" })).toThrow("Не удалось определить SMTP");
  });

  it("creates nodemailer transport from auto SMTP settings", async () => {
    const service = new EmailService({
      EMAIL_PROVIDER: "smtp",
      SMTP_USER: "sender@gmail.com",
      SMTP_PASSWORD: "app-password"
    });

    await service.sendPasswordResetCode(
      {
        id: "user-1",
        name: "Матвей",
        email: "receiver@example.com",
        createdAt: "2026-04-22T10:00:00.000Z"
      },
      "123456"
    );

    expect(mailer.createTransport).toHaveBeenCalledWith({
      host: "smtp.gmail.com",
      port: 587,
      secure: false,
      auth: { user: "sender@gmail.com", pass: "app-password" }
    });
    expect(mailer.sendMail).toHaveBeenCalledWith(expect.objectContaining({
      from: "SmartHome <sender@gmail.com>",
      to: "receiver@example.com",
      subject: "Код восстановления пароля SmartHome"
    }));
  });

  it("sends reset code through Resend API", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({ id: "email-1" }),
      text: async () => ""
    } as Response);
    const service = new EmailService({
      EMAIL_PROVIDER: "resend",
      RESEND_API_KEY: "re_test",
      EMAIL_FROM: "SmartHome <onboarding@resend.dev>"
    });

    await service.sendPasswordResetCode(
      {
        id: "user-1",
        name: "Матвей",
        email: "receiver@example.com",
        createdAt: "2026-04-22T10:00:00.000Z"
      },
      "123456"
    );

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.resend.com/emails",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer re_test",
          "User-Agent": "smart-flow-home-bff/1.0"
        }),
        body: expect.stringContaining("123456")
      })
    );
    fetchMock.mockRestore();
  });
});
