import nodemailer from "nodemailer";
import { env } from "../config/env.js";
import type { User } from "../domain/types.js";
import { resolveSmtpConfig, type SmtpConfigInput } from "./smtpConfig.js";

type EmailSettings = SmtpConfigInput & {
  SMTP_HOST?: string;
  SMTP_PORT?: number;
  SMTP_SECURE?: boolean;
  SMTP_USER?: string;
  SMTP_PASSWORD?: string;
  SMTP_FROM?: string;
  EMAIL_PROVIDER?: "resend" | "smtp" | "dev";
  RESEND_API_KEY?: string;
  EMAIL_FROM?: string;
  NODE_ENV?: string;
};

export class EmailService {
  constructor(private readonly settings: EmailSettings = env) {}

  isConfigured() {
    if ((this.settings.EMAIL_PROVIDER ?? "resend") === "dev") {
      return true;
    }
    if ((this.settings.EMAIL_PROVIDER ?? "resend") === "smtp") {
      return Boolean(this.settings.user ?? this.settings.SMTP_USER) && Boolean(this.settings.password ?? this.settings.SMTP_PASSWORD);
    }
    return Boolean(this.settings.RESEND_API_KEY) && Boolean(this.settings.EMAIL_FROM);
  }

  async sendPasswordResetCode(user: User, code: string) {
    const email = buildPasswordResetEmail(user, code);
    const provider = this.settings.EMAIL_PROVIDER ?? "resend";

    if (provider === "dev") {
      if ((this.settings.NODE_ENV ?? "development") !== "test") {
        console.info(`[SmartHome] Password reset code for ${user.email}: ${code}`);
      }
      return;
    }

    if (provider === "smtp") {
      await this.sendViaSmtp(user.email, email);
      return;
    }

    await this.sendViaResend(user.email, email);
  }

  private async sendViaResend(to: string, email: PasswordResetEmail) {
    const apiKey = this.settings.RESEND_API_KEY;
    const from = this.settings.EMAIL_FROM;

    if (!apiKey || !from) {
      throw new Error("Email API не настроен. Заполните RESEND_API_KEY и EMAIL_FROM или включите EMAIL_PROVIDER=dev для локальной демонстрации");
    }

    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "User-Agent": "smart-flow-home-bff/1.0"
      },
      body: JSON.stringify({
        from,
        to,
        subject: email.subject,
        text: email.text,
        html: email.html
      })
    });

    if (!response.ok) {
      const payload = await response.text().catch(() => "");
      throw new Error(`Resend не отправил письмо. Проверьте RESEND_API_KEY и EMAIL_FROM. Статус: ${response.status}${payload ? `, ответ: ${payload}` : ""}`);
    }
  }

  private async sendViaSmtp(to: string, email: PasswordResetEmail) {
    const smtp = resolveSmtpConfig({
      host: this.settings.host ?? this.settings.SMTP_HOST,
      port: this.settings.port ?? this.settings.SMTP_PORT,
      secure: this.settings.secure ?? this.settings.SMTP_SECURE,
      user: this.settings.user ?? this.settings.SMTP_USER,
      password: this.settings.password ?? this.settings.SMTP_PASSWORD,
      from: this.settings.from ?? this.settings.SMTP_FROM
    });
    const transporter = nodemailer.createTransport(smtp.transport);

    await transporter.sendMail({
      from: smtp.from,
      to,
      subject: email.subject,
      text: email.text,
      html: email.html
    });
  }
}

type PasswordResetEmail = {
  subject: string;
  text: string;
  html: string;
};

function buildPasswordResetEmail(user: User, code: string): PasswordResetEmail {
  return {
    subject: "Код восстановления пароля SmartHome",
    text: `Здравствуйте, ${user.name}. Код восстановления пароля SmartHome: ${code}. Код действует 10 минут.`,
    html: `
      <div style="font-family: Inter, Arial, sans-serif; line-height: 1.5; color: #111827;">
        <h2 style="margin: 0 0 12px;">Сервис SmartHome</h2>
        <p>Здравствуйте, ${escapeHtml(user.name)}.</p>
        <p>Если это вы хотите сбросить пароль, введите этот код в приложении. Код действует 10 минут.</p>
        <div style="display: inline-block; border-radius: 16px; background: #f4f4f5; color: #111827; padding: 16px 22px; font-size: 28px; font-weight: 800; letter-spacing: 6px;">
          ${code}
        </div>
        <p style="color: #64748b; font-size: 13px;">Если вы не запрашивали сброс, просто проигнорируйте это письмо.</p>
      </div>
    `
  };
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
