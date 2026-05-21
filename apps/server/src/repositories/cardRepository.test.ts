import 'reflect-metadata';
import { CardRepository } from './cardRepository';
import type { DataSource } from 'typeorm';

// ─── In-memory store ──────────────────────────────────────────────────────────

const USER_A = 'user-a-uuid';
const USER_B = 'user-b-uuid';

type StoreRow = {
  id: string;
  name: string;
  userId: string;
  numberOwned: number;
  createdAt: Date;
  updatedAt: Date;
};

const makeCard = (id: string, name: string, userId: string, numberOwned = 1): StoreRow => ({
  id,
  name,
  userId,
  numberOwned,
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
});

let store: StoreRow[] = [];

const seedDefaultStore = (): void => {
  store = [
    makeCard('card-1', 'Lightning Bolt', USER_A, 3),
    makeCard('card-2', 'Sol Ring', USER_B, 1),
  ];
};

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockFind = jest.fn(async (opts: { where: { userId: string }; order?: unknown }) =>
  store.filter((c) => c.userId === opts.where.userId),
);
const mockFindOne = jest.fn(async (opts: { where: { id: string; userId: string } }) =>
  store.find((c) => c.id === opts.where.id && c.userId === opts.where.userId) ?? null,
);
const mockSave = jest.fn(async (entity: Partial<StoreRow> & { id: string; name?: string; userId: string }) => {
  const existing = store.find((c) => c.id === entity.id && c.userId === entity.userId);
  if (existing) {
    if (typeof entity.numberOwned === 'number') existing.numberOwned = entity.numberOwned;
    if (typeof entity.name === 'string') existing.name = entity.name;
    existing.updatedAt = new Date();
    return existing;
  }
  const fresh: StoreRow = {
    id: entity.id,
    name: entity.name ?? 'Unnamed',
    userId: entity.userId,
    numberOwned: typeof entity.numberOwned === 'number' ? entity.numberOwned : 1,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  store.push(fresh);
  return fresh;
});
const mockDelete = jest.fn(async (criteria: { id: string; userId: string }) => {
  const before = store.length;
  store = store.filter((c) => !(c.id === criteria.id && c.userId === criteria.userId));
  return { affected: before - store.length };
});

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

beforeEach(() => {
  seedDefaultStore();
  mockFind.mockClear();
  mockFindOne.mockClear();
  mockSave.mockClear();
  mockDelete.mockClear();
  mockDelete.mockImplementation(async (criteria: { id: string; userId: string }) => {
    const before = store.length;
    store = store.filter((c) => !(c.id === criteria.id && c.userId === criteria.userId));
    return { affected: before - store.length };
  });
});

describe('cardRepository', () => {
  describe('findAll / findById / create / remove (existing CRUD)', () => {
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
      const mtgjsonId = '11111111-1111-4111-8111-111111111111';
      const card = await repo.create({ id: mtgjsonId, name: 'Black Lotus' }, USER_A);
      expect(mockSave.mock.calls.length).toBe(1);
      const saveArg = mockSave.mock.calls[0]![0] as { id: string; name: string; userId: string };
      expect(saveArg.id).toBe(mtgjsonId);
      expect(saveArg.userId).toBe(USER_A);
      expect(card.id).toBe(mtgjsonId);
    });

    test('remove calls delete with id+userId criteria', async () => {
      const deleted = await repo.remove('card-1', USER_A);
      expect(deleted).toBe(true);
      const deleteArg = mockDelete.mock.calls[0]![0] as { id: string; userId: string };
      expect(deleteArg.id).toBe('card-1');
      expect(deleteArg.userId).toBe(USER_A);
    });

    test('remove returns false when affected is 0', async () => {
      const deleted = await repo.remove('card-x', USER_B);
      expect(deleted).toBe(false);
    });
  });

  // ─── Spec 018 / FR-025, FR-026, FR-028 — owned-count mutations ────────────

  describe('upsertIncrement (spec 018 / FR-025)', () => {
    test('creates a fresh row at numberOwned=1 with wasCreated=true', async () => {
      const result = await repo.upsertIncrement('new-id', 'Goblin Guide', USER_A);
      expect(result.wasCreated).toBe(true);
      expect(result.card.id).toBe('new-id');
      expect(result.card.numberOwned).toBe(1);
      expect(store.find((c) => c.id === 'new-id' && c.userId === USER_A)?.numberOwned).toBe(1);
    });

    test('increments on duplicate (id, userId) with wasCreated=false', async () => {
      const result = await repo.upsertIncrement('card-1', 'Lightning Bolt', USER_A);
      expect(result.wasCreated).toBe(false);
      expect(result.card.numberOwned).toBe(4);
      expect(store.find((c) => c.id === 'card-1' && c.userId === USER_A)?.numberOwned).toBe(4);
    });

    test('treats (id, userId) uniqueness — same id for a different user creates a fresh row', async () => {
      const result = await repo.upsertIncrement('card-1', 'Lightning Bolt', USER_B);
      expect(result.wasCreated).toBe(true);
      expect(result.card.numberOwned).toBe(1);
      expect(
        store.filter((c) => c.id === 'card-1').map((c) => `${c.userId}:${c.numberOwned}`).sort(),
      ).toEqual([`${USER_A}:3`, `${USER_B}:1`]);
    });
  });

  describe('adjustNumberOwned (spec 018 / FR-026, FR-028)', () => {
    test('delta:+1 increments and returns the updated card', async () => {
      const result = await repo.adjustNumberOwned('card-1', USER_A, 1);
      expect(result.status).toBe('updated');
      if (result.status !== 'updated') throw new Error('narrowing');
      expect(result.card.numberOwned).toBe(4);
    });

    test('delta:-1 at count>1 decrements and returns the updated card', async () => {
      const result = await repo.adjustNumberOwned('card-1', USER_A, -1);
      expect(result.status).toBe('updated');
      if (result.status !== 'updated') throw new Error('narrowing');
      expect(result.card.numberOwned).toBe(2);
    });

    test('delta:-1 at count=1 deletes the row and returns status:deleted', async () => {
      // card-2 starts at numberOwned=1 for USER_B.
      const result = await repo.adjustNumberOwned('card-2', USER_B, -1);
      expect(result.status).toBe('deleted');
      expect(store.find((c) => c.id === 'card-2' && c.userId === USER_B)).toBeUndefined();
    });

    test('delta:-1 against a non-row returns status:notfound', async () => {
      const result = await repo.adjustNumberOwned('does-not-exist', USER_A, -1);
      expect(result.status).toBe('notfound');
    });

    test('delta:+1 against a non-row returns status:notfound (PATCH semantics)', async () => {
      const result = await repo.adjustNumberOwned('does-not-exist', USER_A, 1);
      expect(result.status).toBe('notfound');
    });
  });
});
