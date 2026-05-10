import type { CardSet, MtgjsonSDK } from 'mtgjson-sdk';

// Minimal CardSet factory — only fields used by the mapper and enrichment.
function makeCard(overrides: Partial<Record<string, unknown>> = {}): CardSet {
  return {
    name: 'Lightning Bolt',
    setCode: 'M11',
    number: '149',
    manaCost: '{R}',
    colorIdentity: ['R'],
    availability: ['paper'],
    borderColor: 'black',
    colors: ['R'],
    convertedManaCost: 1,
    finishes: [],
    frameVersion: '2015',
    language: 'English',
    layout: 'normal',
    manaValue: 1,
    purchaseUrls: {},
    rarity: 'common',
    subtypes: [],
    supertypes: [],
    type: 'Instant',
    types: ['Instant'],
    uuid: 'uuid-001',
    ...overrides,
  } as unknown as CardSet;
}

function makeSdk(overrides: Partial<MtgjsonSDK> = {}): MtgjsonSDK {
  return {
    cards: {
      search: jest.fn().mockResolvedValue([]),
      getByName: jest.fn().mockResolvedValue([]),
      getByUuid: jest.fn().mockResolvedValue(null),
      getPrintings: jest.fn().mockResolvedValue([]),
    },
    identifiers: {
      getIdentifiers: jest.fn().mockResolvedValue({ scryfallId: 'sf-001' }),
    },
    legalities: {
      isLegal: jest.fn().mockResolvedValue(true),
    },
    sets: {
      get: jest.fn().mockResolvedValue({ name: 'Magic 2011' }),
    },
    close: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  } as unknown as MtgjsonSDK;
}

// Import after factory definitions so types are available.
import { MtgjsonProvider } from '@src/providers/mtgjson/index';

describe('MtgjsonProvider.search — sequential enrichment', () => {
  test('enriches cards sequentially (no parallel fan-out)', async () => {
    const callOrder: string[] = [];
    const cards = [
      makeCard({ uuid: 'uuid-001', name: 'Lightning Bolt' }),
      makeCard({ uuid: 'uuid-002', name: 'Shock' }),
      makeCard({ uuid: 'uuid-003', name: 'Chain Lightning' }),
    ];

    const sdk = makeSdk();
    (sdk.cards.search as jest.Mock).mockResolvedValue(cards);

    // Track call order to prove sequential execution.
    (sdk.identifiers.getIdentifiers as jest.Mock).mockImplementation(
      (uuid: string) => {
        callOrder.push(`ids-${uuid}`);
        return Promise.resolve({ scryfallId: `sf-${uuid}` });
      },
    );
    (sdk.legalities.isLegal as jest.Mock).mockImplementation(
      (uuid: string) => {
        callOrder.push(`legal-${uuid}`);
        return Promise.resolve(true);
      },
    );

    const provider = new MtgjsonProvider(sdk);
    const results = await provider.search({ name: 'bolt' });

    // All 3 cards enriched.
    expect(results).toHaveLength(3);

    // Verify sequential order: card 1 fully enriched before card 2 starts.
    // Within a card, ids and legal run in parallel (Promise.all), so their
    // relative order is non-deterministic. But card boundaries must be respected.
    const card1Calls = callOrder.filter((c) => c.includes('uuid-001'));
    const card2Calls = callOrder.filter((c) => c.includes('uuid-002'));
    const card3Calls = callOrder.filter((c) => c.includes('uuid-003'));

    const lastCard1Index = Math.max(...card1Calls.map((c) => callOrder.indexOf(c)));
    const firstCard2Index = Math.min(...card2Calls.map((c) => callOrder.indexOf(c)));
    const lastCard2Index = Math.max(...card2Calls.map((c) => callOrder.indexOf(c)));
    const firstCard3Index = Math.min(...card3Calls.map((c) => callOrder.indexOf(c)));

    expect(lastCard1Index).toBeLessThan(firstCard2Index);
    expect(lastCard2Index).toBeLessThan(firstCard3Index);
  });

  test('returns enriched CardRecord with scryfallId and commanderLegal', async () => {
    const card = makeCard({ uuid: 'uuid-001' });
    const sdk = makeSdk();
    (sdk.cards.search as jest.Mock).mockResolvedValue([card]);
    (sdk.identifiers.getIdentifiers as jest.Mock).mockResolvedValue({
      scryfallId: 'e3285fd6-example',
    });
    (sdk.legalities.isLegal as jest.Mock).mockResolvedValue(false);

    const provider = new MtgjsonProvider(sdk);
    const results = await provider.search({ name: 'bolt' });

    expect(results).toHaveLength(1);
    expect(results[0]!.imageRef).toBe('e3285fd6-example');
    expect(results[0]!.commanderLegal).toBe(false);
  });

  test('returns null imageRef when identifiers are undefined', async () => {
    const card = makeCard({ uuid: 'uuid-001' });
    const sdk = makeSdk();
    (sdk.cards.search as jest.Mock).mockResolvedValue([card]);
    (sdk.identifiers.getIdentifiers as jest.Mock).mockResolvedValue(undefined);
    (sdk.legalities.isLegal as jest.Mock).mockResolvedValue(true);

    const provider = new MtgjsonProvider(sdk);
    const results = await provider.search({ name: 'bolt' });

    expect(results).toHaveLength(1);
    expect(results[0]!.imageRef).toBeNull();
    expect(results[0]!.commanderLegal).toBe(true);
  });

  test('returns empty array when search yields no cards', async () => {
    const sdk = makeSdk();
    (sdk.cards.search as jest.Mock).mockResolvedValue([]);

    const provider = new MtgjsonProvider(sdk);
    const results = await provider.search({ name: 'nonexistent' });

    expect(results).toEqual([]);
    expect(sdk.identifiers.getIdentifiers).not.toHaveBeenCalled();
    expect(sdk.legalities.isLegal).not.toHaveBeenCalled();
  });

  test('calls legalities.isLegal for each card', async () => {
    const cards = [
      makeCard({ uuid: 'uuid-001' }),
      makeCard({ uuid: 'uuid-002' }),
    ];
    const sdk = makeSdk();
    (sdk.cards.search as jest.Mock).mockResolvedValue(cards);

    const provider = new MtgjsonProvider(sdk);
    await provider.search({ name: 'bolt' });

    expect(sdk.legalities.isLegal).toHaveBeenCalledTimes(2);
    expect(sdk.legalities.isLegal).toHaveBeenCalledWith('uuid-001', 'commander');
    expect(sdk.legalities.isLegal).toHaveBeenCalledWith('uuid-002', 'commander');
  });
});

describe('MtgjsonProvider.getByUuid', () => {
  test('returns CardDetails populated from sdk.cards + identifiers + sets', async () => {
    const sdk = makeSdk();
    (sdk.cards.getByUuid as jest.Mock).mockResolvedValue(
      makeCard({ uuid: 'uuid-bolt', name: 'Lightning Bolt', setCode: 'M11', number: '149', type: 'Instant' }),
    );
    (sdk.identifiers.getIdentifiers as jest.Mock).mockResolvedValue({ scryfallId: 'sf-bolt' });
    (sdk.sets.get as jest.Mock).mockResolvedValue({ name: 'Magic 2011' });

    const provider = new MtgjsonProvider(sdk);
    const details = await provider.getByUuid('uuid-bolt');

    expect(details).toEqual({
      uuid: 'uuid-bolt',
      name: 'Lightning Bolt',
      setCode: 'M11',
      setName: 'Magic 2011',
      cardNumber: '149',
      typeLine: 'Instant',
      scryfallId: 'sf-bolt',
    });
  });

  test('returns null when sdk.cards.getByUuid returns null', async () => {
    const sdk = makeSdk();
    (sdk.cards.getByUuid as jest.Mock).mockResolvedValue(null);

    const provider = new MtgjsonProvider(sdk);
    const details = await provider.getByUuid('unknown-uuid');

    expect(details).toBeNull();
    expect(sdk.identifiers.getIdentifiers).not.toHaveBeenCalled();
    expect(sdk.sets.get).not.toHaveBeenCalled();
  });

  test('scryfallId is null when identifiers omit it', async () => {
    const sdk = makeSdk();
    (sdk.cards.getByUuid as jest.Mock).mockResolvedValue(makeCard({ uuid: 'uuid-001' }));
    (sdk.identifiers.getIdentifiers as jest.Mock).mockResolvedValue(undefined);

    const provider = new MtgjsonProvider(sdk);
    const details = await provider.getByUuid('uuid-001');

    expect(details?.scryfallId).toBeNull();
  });

  test('setName is null when sdk.sets.get returns null', async () => {
    const sdk = makeSdk();
    (sdk.cards.getByUuid as jest.Mock).mockResolvedValue(makeCard({ uuid: 'uuid-001', setCode: 'XYZ' }));
    (sdk.sets.get as jest.Mock).mockResolvedValue(null);

    const provider = new MtgjsonProvider(sdk);
    const details = await provider.getByUuid('uuid-001');

    expect(details?.setName).toBeNull();
    expect(details?.setCode).toBe('XYZ');
  });
});
