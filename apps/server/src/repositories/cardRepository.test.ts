import 'reflect-metadata';
import { CardRepository } from './cardRepository';
import type { DataSource } from 'typeorm';

// ─── In-memory store ──────────────────────────────────────────────────────────

const USER_A = 'user-a-uuid';
const USER_B = 'user-b-uuid';

const makeCard = (id: string, name: string, userId: string, numberOwned = 1) => ({
  id,
  name,
  userId,
  numberOwned,
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
});

const storeA = [makeCard('card-1', 'Lightning Bolt', USER_A, 3)];
const storeB = [makeCard('card-2', 'Sol Ring', USER_B, 1)];
const store = [...storeA, ...storeB];

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockFind = jest.fn(async (opts: { where: { userId: string }; order?: unknown }) =>
  store.filter((c) => c.userId === opts.where.userId),
);
const mockFindOne = jest.fn(async (opts: { where: { id: string; userId: string } }) =>
  store.find((c) => c.id === opts.where.id && c.userId === opts.where.userId) ?? null,
);
const mockSave = jest.fn(async (entity: { id: string; name: string; userId: string }) => ({
  id: entity.id,
  name: entity.name,
  userId: entity.userId,
  numberOwned: 1,
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

  test('findAll projects numberOwned on every row (spec 018 / FR-023)', async () => {
    const cards = await repo.findAll(USER_A);
    expect(cards[0]?.numberOwned).toBe(3);

    const otherUserCards = await repo.findAll(USER_B);
    expect(otherUserCards[0]?.numberOwned).toBe(1);
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
    const mtgjsonId = '11111111-1111-4111-8111-111111111111';
    const card = await repo.create({ id: mtgjsonId, name: 'Black Lotus' }, USER_A);
    expect(mockSave.mock.calls.length).toBe(1);
    const saveArg = mockSave.mock.calls[0]![0] as { id: string; name: string; userId: string };
    expect(saveArg.id).toBe(mtgjsonId);
    expect(saveArg.userId).toBe(USER_A);
    expect(card.id).toBe(mtgjsonId);
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
