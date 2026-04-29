import 'reflect-metadata';
import { CardRepository } from './cardRepository';
import type { DataSource } from 'typeorm';

// ─── In-memory store ──────────────────────────────────────────────────────────

const USER_A = 'user-a-uuid';
const USER_B = 'user-b-uuid';

const makeCard = (id: string, name: string, userId: string) => ({
  id,
  name,
  userId,
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
});

const storeA = [makeCard('card-1', 'Lightning Bolt', USER_A)];
const storeB = [makeCard('card-2', 'Sol Ring', USER_B)];
const store = [...storeA, ...storeB];

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockFind = jest.fn(async (opts: { where: { userId: string }; order?: unknown }) =>
  store.filter((c) => c.userId === opts.where.userId),
);
const mockFindOne = jest.fn(async (opts: { where: { id: string; userId: string } }) =>
  store.find((c) => c.id === opts.where.id && c.userId === opts.where.userId) ?? null,
);
const mockSave = jest.fn(async (entity: { name: string; userId: string }) => ({
  id: 'new-card-uuid',
  name: entity.name,
  userId: entity.userId,
  createdAt: new Date(),
  updatedAt: new Date(),
}));
const mockDelete = jest.fn(async (_criteria: unknown) => ({ affected: 1 }));

const mockDs = {
  getRepository: () => ({
    find: mockFind,
    findOne: mockFindOne,
    save: mockSave,
    delete: mockDelete,
  }),
} as unknown as DataSource;

// ─── Tests ────────────────────────────────────────────────────────────────────

const repo = new CardRepository(mockDs);

describe('cardRepository', () => {
  test('findAll returns only cards for the requesting user', async () => {
    const cards = await repo.findAll(USER_A);
    expect(cards.length).toBe(1);
    expect(cards[0]?.name).toBe('Lightning Bolt');
  });

  test('findAll for userB does not return userA cards', async () => {
    const cards = await repo.findAll(USER_B);
    expect(cards.length).toBe(1);
    expect(cards[0]?.name).toBe('Sol Ring');
  });

  test('findById returns card when it belongs to user', async () => {
    const card = await repo.findById('card-1', USER_A);
    expect(card).not.toBeNull();
    expect(card!.name).toBe('Lightning Bolt');
  });

  test('findById returns null when card belongs to different user', async () => {
    const card = await repo.findById('card-1', USER_B);
    expect(card).toBeNull();
  });

  test('create saves card with userId and returns it', async () => {
    mockSave.mockClear();
    const card = await repo.create({ name: 'Black Lotus' }, USER_A);
    expect(mockSave.mock.calls.length).toBe(1);
    const saveArg = mockSave.mock.calls[0]![0] as { name: string; userId: string };
    expect(saveArg.userId).toBe(USER_A);
    expect(card.id).toBe('new-card-uuid');
  });

  test('remove calls delete with id+userId criteria', async () => {
    mockDelete.mockClear();
    const deleted = await repo.remove('card-1', USER_A);
    expect(deleted).toBe(true);
    const deleteArg = mockDelete.mock.calls[0]![0] as { id: string; userId: string };
    expect(deleteArg.id).toBe('card-1');
    expect(deleteArg.userId).toBe(USER_A);
  });

  test('remove returns false when affected is 0', async () => {
    mockDelete.mockImplementation(async () => ({ affected: 0 }));
    const deleted = await repo.remove('card-x', USER_B);
    expect(deleted).toBe(false);
  });
});
