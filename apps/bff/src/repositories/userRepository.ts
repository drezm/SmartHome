import { randomUUID } from "node:crypto";
import type { Database } from "better-sqlite3";
import type { User, UserWithPassword } from "../domain/types.js";
import { seedHomeForUser } from "../db/database.js";

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

    const createUser = this.db.transaction(() => {
      this.db
        .prepare("INSERT INTO users (id, name, email, password_hash, created_at) VALUES (?, ?, ?, ?, ?)")
        .run(userId, input.name, input.email.toLowerCase(), input.passwordHash, createdAt);
      seedHomeForUser(this.db, userId);
    });

    createUser();

    return {
      id: userId,
      name: input.name,
      email: input.email.toLowerCase(),
      createdAt
    };
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
