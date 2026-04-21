import bcrypt from "bcryptjs";
import jwt, { type SignOptions } from "jsonwebtoken";
import { env } from "../config/env.js";
import type { AuthSession, User } from "../domain/types.js";
import type { UserStore } from "../repositories/contracts.js";

type JwtPayload = {
  sub: string;
  email: string;
};

export class AuthService {
  constructor(private readonly users: UserStore) {}

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

function withoutPassword(user: User & { passwordHash?: string }): User {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    createdAt: user.createdAt
  };
}
