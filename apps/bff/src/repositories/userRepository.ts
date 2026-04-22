import { randomUUID } from "node:crypto";
import type { Database } from "better-sqlite3";
import type { User, UserWithPassword } from "../domain/types.js";

type UserRow = {
  id: string;
  name: string;
  email: string;
  password_hash: string;
  created_at: string;
};

export class UserRepository {
  constructor(private readonly db: Database) {}

  findByEmail(email: string): UserWithPassword | null {
    const row = this.db.prepare("SELECT * FROM users WHERE email = ?").get(email.toLowerCase()) as UserRow | undefined;
    return row ? mapUserWithPassword(row) : null;
  }

  findById(id: string): User | null {
    const row = this.db.prepare("SELECT * FROM users WHERE id = ?").get(id) as UserRow | undefined;
    return row ? mapUser(row) : null;
  }

  create(input: { name: string; email: string; passwordHash: string }): User {
    const userId = randomUUID();
    const createdAt = new Date().toISOString();

    this.db
      .prepare("INSERT INTO users (id, name, email, password_hash, created_at) VALUES (?, ?, ?, ?, ?)")
      .run(userId, input.name, input.email.toLowerCase(), input.passwordHash, createdAt);

    return {
      id: userId,
      name: input.name,
      email: input.email.toLowerCase(),
      createdAt
    };
  }

  updatePassword(userId: string, passwordHash: string): void {
    this.db.prepare("UPDATE users SET password_hash = ? WHERE id = ?").run(passwordHash, userId);
  }

  createPasswordReset(input: { userId: string; tokenHash: string; expiresAt: string }): void {
    const now = new Date().toISOString();
    this.db
      .prepare("INSERT INTO password_reset_tokens (id, user_id, token_hash, expires_at, consumed_at, created_at) VALUES (?, ?, ?, ?, NULL, ?)")
      .run(randomUUID(), input.userId, input.tokenHash, input.expiresAt, now);
  }

  findPasswordReset(tokenHash: string): { id: string; userId: string; expiresAt: string; consumedAt: string | null } | null {
    const row = this.db
      .prepare("SELECT id, user_id, expires_at, consumed_at FROM password_reset_tokens WHERE token_hash = ?")
      .get(tokenHash) as { id: string; user_id: string; expires_at: string; consumed_at: string | null } | undefined;

    return row
      ? {
          id: row.id,
          userId: row.user_id,
          expiresAt: row.expires_at,
          consumedAt: row.consumed_at
        }
      : null;
  }

  consumePasswordReset(id: string): void {
    this.db.prepare("UPDATE password_reset_tokens SET consumed_at = ? WHERE id = ?").run(new Date().toISOString(), id);
  }
}

function mapUser(row: UserRow): User {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    createdAt: row.created_at
  };
}

function mapUserWithPassword(row: UserRow): UserWithPassword {
  return {
    ...mapUser(row),
    passwordHash: row.password_hash
  };
}
