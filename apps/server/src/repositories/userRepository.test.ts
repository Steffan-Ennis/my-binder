import { test, describe, mock } from 'node:test';
import assert from 'node:assert/strict';
import 'reflect-metadata';
import { UserRepository, type UpsertUserInput } from './userRepository';
import type { DataSource } from 'typeorm';

// ─── Mocks ───────────────────────────────────────────────────────────────────

const mockUpsert = mock.fn(async () => undefined);
const mockFindOneByOrFail = mock.fn(async () => ({
  id: 'user-uuid-1',
  email: 'user@gmail.com',
  displayName: 'Jane Doe',
  avatarUrl: 'https://lh3.googleusercontent.com/photo.jpg',
}));
const mockFindOneBy = mock.fn(async () => null as Record<string, unknown> | null);

const mockDs = {
  getRepository: () => ({
    upsert: mockUpsert,
    findOneByOrFail: mockFindOneByOrFail,
    findOneBy: mockFindOneBy,
  }),
} as unknown as DataSource;

// ─── Tests ────────────────────────────────────────────────────────────────────

const repo = new UserRepository(mockDs);

const baseInput: UpsertUserInput = {
  email: 'user@gmail.com',
  displayName: 'Jane Doe',
  avatarUrl: 'https://lh3.googleusercontent.com/photo.jpg',
};

describe('userRepository', () => {
  describe('upsertUser', () => {
    test('calls upsert with conflictPaths and returns AuthUser', async () => {
      mockUpsert.mock.resetCalls();
      mockFindOneByOrFail.mock.mockImplementation(async () => ({
        id: 'user-uuid-1',
        email: 'user@gmail.com',
        displayName: 'Jane Doe',
        avatarUrl: 'https://lh3.googleusercontent.com/photo.jpg',
      }));

      const result = await repo.upsertUser(baseInput);

      assert.equal(mockUpsert.mock.callCount(), 1);
      const callArgs = mockUpsert.mock.calls[0]?.arguments as unknown as [unknown, { conflictPaths: string[] }];
      const opts = callArgs[1];
      assert.deepEqual(opts.conflictPaths, ['email']);
      assert.equal(result.email, 'user@gmail.com');
      assert.equal(result.displayName, 'Jane Doe');
    });

    test('concurrent upserts with same email do not error', async () => {
      const [a, b] = await Promise.all([repo.upsertUser(baseInput), repo.upsertUser(baseInput)]);
      assert.equal(a.email, b.email);
    });
  });

  describe('findUserById', () => {
    test('returns null for unknown id', async () => {
      mockFindOneBy.mock.mockImplementation(async () => null);
      const result = await repo.findUserById('00000000-0000-0000-0000-000000000000');
      assert.equal(result, null);
    });

    test('returns AuthUser when found', async () => {
      mockFindOneBy.mock.mockImplementation(async () => ({
        id: 'user-uuid-1',
        email: 'user@gmail.com',
        displayName: 'Jane Doe',
        avatarUrl: null,
      }));

      const result = await repo.findUserById('user-uuid-1');
      assert.ok(result !== null);
      assert.equal(result.id, 'user-uuid-1');
      assert.equal(result.email, 'user@gmail.com');
    });
  });
});
