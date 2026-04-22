import { randomUUID } from "node:crypto";
import type { Pool, PoolClient } from "pg";
import type { User, UserWithPassword } from "../domain/types.js";
import type { UserStore } from "./contracts.js";

type UserRow = {
  id: string;
  name: string;
  email: string;
  password_hash: string;
  created_at: string;
};

export class PostgresUserRepository implements UserStore {
  constructor(private readonly db: Pool) {}

  async findByEmail(email: string): Promise<UserWithPassword | null> {
    const result = await this.db.query<UserRow>("SELECT * FROM users WHERE email = $1", [email.toLowerCase()]);
    return result.rows[0] ? mapUserWithPassword(result.rows[0]) : null;
  }

  async findById(id: string): Promise<User | null> {
    const result = await this.db.query<UserRow>("SELECT * FROM users WHERE id = $1", [id]);
    return result.rows[0] ? mapUser(result.rows[0]) : null;
  }

  async create(input: { name: string; email: string; passwordHash: string }): Promise<User> {
    const client = await this.db.connect();
    const userId = randomUUID();
    const createdAt = new Date().toISOString();

    try {
      await client.query("BEGIN");
      await client.query("INSERT INTO users (id, name, email, password_hash, created_at) VALUES ($1, $2, $3, $4, $5)", [
        userId,
        input.name,
        input.email.toLowerCase(),
        input.passwordHash,
        createdAt
      ]);
      await client.query("COMMIT");
    } catch (error) {
      await rollback(client);
      throw error;
    } finally {
      client.release();
    }

    return {
      id: userId,
      name: input.name,
      email: input.email.toLowerCase(),
      createdAt
    };
  }

  async updatePassword(userId: string, passwordHash: string): Promise<void> {
    await this.db.query("UPDATE users SET password_hash = $1 WHERE id = $2", [passwordHash, userId]);
  }

  async createPasswordReset(input: { userId: string; tokenHash: string; expiresAt: string }): Promise<void> {
    await this.db.query("INSERT INTO password_reset_tokens (id, user_id, token_hash, expires_at, consumed_at, created_at) VALUES ($1, $2, $3, $4, NULL, $5)", [
      randomUUID(),
      input.userId,
      input.tokenHash,
      input.expiresAt,
      new Date().toISOString()
    ]);
  }

  async findPasswordReset(tokenHash: string): Promise<{ id: string; userId: string; expiresAt: string; consumedAt: string | null } | null> {
    const result = await this.db.query<{ id: string; user_id: string; expires_at: string; consumed_at: string | null }>(
      "SELECT id, user_id, expires_at, consumed_at FROM password_reset_tokens WHERE token_hash = $1",
      [tokenHash]
    );
    const row = result.rows[0];

    return row
      ? {
          id: row.id,
          userId: row.user_id,
          expiresAt: row.expires_at,
          consumedAt: row.consumed_at
        }
      : null;
  }

  async consumePasswordReset(id: string): Promise<void> {
    await this.db.query("UPDATE password_reset_tokens SET consumed_at = $1 WHERE id = $2", [new Date().toISOString(), id]);
  }
}

async function rollback(client: PoolClient) {
  try {
    await client.query("ROLLBACK");
  } catch {
    // Ignore rollback failures so the original error remains visible.
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
