import type { AuthUser } from '@my-binder/core';
import { getDb, fetchRows } from '@src/db/client';

type UpsertUserInput = {
  googleSub: string;
  email: string;
  displayName: string;
  avatarUrl: string | null;
};

function toAuthUser(row: Record<string, unknown>): AuthUser {
  return {
    id: String(row['id']),
    email: String(row['email']),
    displayName: String(row['display_name']),
    avatarUrl: row['avatar_url'] != null ? String(row['avatar_url']) : null,
  };
}

/**
 * Insert or update a user keyed on google_sub.
 * Uses INSERT … ON CONFLICT to avoid read-then-write race conditions.
 */
export async function upsertUser(input: UpsertUserInput): Promise<AuthUser> {
  const conn = getDb();
  const result = await conn.run(
    `INSERT INTO users (google_sub, email, display_name, avatar_url)
     VALUES (?, ?, ?, ?)
     ON CONFLICT (google_sub) DO UPDATE SET
       email        = excluded.email,
       display_name = excluded.display_name,
       avatar_url   = excluded.avatar_url,
       updated_at   = now()
     RETURNING id, email, display_name, avatar_url`,
    [input.googleSub, input.email, input.displayName, input.avatarUrl],
  );
  const rows = await fetchRows(result);
  return toAuthUser(rows[0] as Record<string, unknown>);
}

/**
 * Find a user by their internal UUID. Returns null if not found.
 */
export async function findUserById(id: string): Promise<AuthUser | null> {
  const conn = getDb();
  const result = await conn.run(
    'SELECT id, email, display_name, avatar_url FROM users WHERE id = ?',
    [id],
  );
  const rows = await fetchRows(result);
  return rows.length > 0 ? toAuthUser(rows[0] as Record<string, unknown>) : null;
}
