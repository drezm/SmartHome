import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import jwt, { type SignOptions } from "jsonwebtoken";
import { env } from "../config/env.js";
import type { AuthSession, User } from "../domain/types.js";
import type { UserStore } from "../repositories/contracts.js";
import { EmailService } from "./emailService.js";
import { hashToken } from "./secretService.js";

type JwtPayload = {
  sub: string;
  email: string;
};

type PasswordResetMailer = {
  isConfigured(): boolean;
  sendPasswordResetCode(user: User, code: string): Promise<void>;
};

export class AuthService {
  constructor(private readonly users: UserStore, private readonly email: PasswordResetMailer = new EmailService()) {}

  async register(input: { name: string; email: string; password: string }): Promise<AuthSession> {
    const existing = await this.users.findByEmail(input.email);
    if (existing) {
      throw new Error("Пользователь с таким email уже существует");
    }

    const passwordHash = await bcrypt.hash(input.password, 10);
    const user = await this.users.create({
      name: input.name,
      email: input.email,
      passwordHash
    });

    return {
      user,
      token: this.sign(user)
    };
  }

  async login(input: { email: string; password: string }): Promise<AuthSession> {
    const user = await this.users.findByEmail(input.email);
    if (!user) {
      throw new Error("Неверный email или пароль");
    }

    const passwordMatches = await bcrypt.compare(input.password, user.passwordHash);
    if (!passwordMatches) {
      throw new Error("Неверный email или пароль");
    }

    return {
      user: withoutPassword(user),
      token: this.sign(user)
    };
  }

  async forgotPassword(input: { email: string }): Promise<{ sent: boolean; devCode?: string }> {
    const email = normalizeEmail(input.email);
    const user = await this.users.findByEmail(email);
    if (!user) {
      return { sent: true };
    }

    const code = createResetCode();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
    await this.users.createPasswordReset({
      userId: user.id,
      tokenHash: hashResetCode(email, code),
      expiresAt
    });

    await this.email.sendPasswordResetCode(user, code);
    return env.EMAIL_PROVIDER === "dev" && env.NODE_ENV !== "production" ? { sent: true, devCode: code } : { sent: true };
  }

  async verifyResetCode(input: { email: string; code: string }): Promise<{ valid: boolean }> {
    await this.getValidReset(input.email, input.code);
    return { valid: true };
  }

  async resetPassword(input: { email: string; code: string; password: string }): Promise<{ changed: boolean }> {
    const reset = await this.getValidReset(input.email, input.code);
    const passwordHash = await bcrypt.hash(input.password, 10);
    await this.users.updatePassword(reset.userId, passwordHash);
    await this.users.consumePasswordReset(reset.id);
    return { changed: true };
  }

  private async getValidReset(emailRaw: string, code: string) {
    const email = normalizeEmail(emailRaw);
    const reset = await this.users.findPasswordReset(hashResetCode(email, code));
    if (!reset || reset.consumedAt || new Date(reset.expiresAt).getTime() < Date.now()) {
      throw new Error("Код восстановления истек или недействителен");
    }
    return reset;
  }

  async verify(token: string): Promise<User> {
    const payload = jwt.verify(token, env.JWT_SECRET) as JwtPayload;
    const user = await this.users.findById(payload.sub);

    if (!user) {
      throw new Error("Пользователь не найден");
    }

    return user;
  }

  private sign(user: Pick<User, "id" | "email">) {
    return jwt.sign({ email: user.email }, env.JWT_SECRET, {
      subject: user.id,
      expiresIn: env.JWT_EXPIRES_IN as SignOptions["expiresIn"]
    });
  }
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function createResetCode() {
  return String(crypto.randomInt(100000, 1_000_000));
}

function hashResetCode(email: string, code: string) {
  return hashToken(`${normalizeEmail(email)}:${code.trim()}`);
}

function withoutPassword(user: User & { passwordHash?: string }): User {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    createdAt: user.createdAt
  };
}
