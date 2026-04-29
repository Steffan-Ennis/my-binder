import 'reflect-metadata';
import { UserRepository, type UpsertUserInput } from './userRepository';
import type { DataSource } from 'typeorm';

// ─── Mocks ───────────────────────────────────────────────────────────────────

const mockUpsert = jest.fn(async () => undefined);
const mockFindOneByOrFail = jest.fn(async () => ({
  id: 'user-uuid-1',
  email: 'user@gmail.com',
  displayName: 'Jane Doe',
  avatarUrl: 'https://lh3.googleusercontent.com/photo.jpg',
}));
const mockFindOneBy = jest.fn(async () => null as Record<string, unknown> | null);

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
      mockUpsert.mockClear();
      mockFindOneByOrFail.mockImplementation(async () => ({
        id: 'user-uuid-1',
        email: 'user@gmail.com',
        displayName: 'Jane Doe',
        avatarUrl: 'https://lh3.googleusercontent.com/photo.jpg',
      }));

      const result = await repo.upsertUser(baseInput);

      expect(mockUpsert.mock.calls.length).toBe(1);
      const callArgs = mockUpsert.mock.calls[0] as unknown as [unknown, { conflictPaths: string[] }];
      const opts = callArgs[1];
      expect(opts.conflictPaths).toEqual(['email']);
      expect(result.email).toBe('user@gmail.com');
      expect(result.displayName).toBe('Jane Doe');
    });

    test('concurrent upserts with same email do not error', async () => {
      const [a, b] = await Promise.all([repo.upsertUser(baseInput), repo.upsertUser(baseInput)]);
      expect(a.email).toBe(b.email);
    });
  });

  describe('findUserById', () => {
    test('returns null for unknown id', async () => {
      mockFindOneBy.mockImplementation(async () => null);
      const result = await repo.findUserById('00000000-0000-0000-0000-000000000000');
      expect(result).toBeNull();
    });

    test('returns AuthUser when found', async () => {
      mockFindOneBy.mockImplementation(async () => ({
        id: 'user-uuid-1',
        email: 'user@gmail.com',
        displayName: 'Jane Doe',
        avatarUrl: null,
      }));

      const result = await repo.findUserById('user-uuid-1');
      expect(result).not.toBeNull();
      expect(result!.id).toBe('user-uuid-1');
      expect(result!.email).toBe('user@gmail.com');
    });
  });
});
