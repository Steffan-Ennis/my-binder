import { Card, CreateCardBody, UpdateCardBody } from '@my-binder/core';
import { getDb, fetchRows } from '@src/db/client';

function toCard(row: Record<string, unknown>): Card {
  return {
    id: String(row['id']),
    name: String(row['name']),
    createdAt: String(row['created_at']),
    updatedAt: String(row['updated_at']),
  };
}

export async function findAll(): Promise<Card[]> {
  const conn = getDb();
  const result = await conn.run('SELECT id, name, created_at, updated_at FROM cards ORDER BY created_at DESC');
  const rows = await fetchRows(result);
  return rows.map(toCard);
}

export async function findById(id: string): Promise<Card | null> {
  const conn = getDb();
  const result = await conn.run(
    'SELECT id, name, created_at, updated_at FROM cards WHERE id = ?',
    [id],
  );
  const rows = await fetchRows(result);
  return rows.length > 0 ? toCard(rows[0] as Record<string, unknown>) : null;
}

export async function create(body: CreateCardBody): Promise<Card> {
  const conn = getDb();
  const result = await conn.run(
    'INSERT INTO cards (name) VALUES (?) RETURNING id, name, created_at, updated_at',
    [body.name],
  );
  const rows = await fetchRows(result);
  return toCard(rows[0] as Record<string, unknown>);
}

export async function update(id: string, body: UpdateCardBody): Promise<Card | null> {
  const conn = getDb();
  const result = await conn.run(
    'UPDATE cards SET name = ?, updated_at = NOW() WHERE id = ? RETURNING id, name, created_at, updated_at',
    [body.name, id],
  );
  const rows = await fetchRows(result);
  return rows.length > 0 ? toCard(rows[0] as Record<string, unknown>) : null;
}

export async function remove(id: string): Promise<boolean> {
  const conn = getDb();
  const result = await conn.run('DELETE FROM cards WHERE id = ? RETURNING id', [id]);
  const rows = await fetchRows(result);
  return rows.length > 0;
}
