
import { pool } from '../config/database.js';

export interface UserRecord {
  id: string;
  email: string;
  password_hash: string | null;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface CreateUserInput {
  email: string;
  passwordHash?: string | null;
}

export const userRepository = {
  async findById(id: string): Promise<UserRecord | null> {
    const result = await pool.query<UserRecord>(
      `SELECT id, email, password_hash, is_active, created_at, updated_at
       FROM users
       WHERE id = $1
       LIMIT 1`,
      [id]
    );

    return result.rows[0] ?? null;
  },

  async findByEmail(email: string): Promise<UserRecord | null> {
    const result = await pool.query<UserRecord>(
      `SELECT id, email, password_hash, is_active, created_at, updated_at
       FROM users
       WHERE LOWER(email) = LOWER($1)
       LIMIT 1`,
      [email.trim()]
    );

    return result.rows[0] ?? null;
  },

  async create(input: CreateUserInput): Promise<UserRecord> {
    const result = await pool.query<UserRecord>(
      `INSERT INTO users (email, password_hash)
       VALUES (LOWER($1), $2)
       RETURNING id, email, password_hash, is_active, created_at, updated_at`,
      [input.email.trim(), input.passwordHash ?? null]
    );

    return result.rows[0]!;
  },
};
