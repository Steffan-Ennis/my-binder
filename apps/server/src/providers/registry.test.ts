import type { CardProvider } from './interface';
import {
  ProviderRegistry,
  ProviderRegistryNotFoundError,
  ProviderRegistryUnreachableError,
} from './registry';

function makeProvider(overrides: Partial<CardProvider> = {}): CardProvider {
  return {
    checkLegality: async (name) => ({ cardName: name, legal: true, reason: null, colorIdentity: [] }),
    searchRaw: async () => ({ cards: [], total: 0 }),
    getByUuid: async () => null,
    getByUuids: async () => [],
    getCardImages: async () => null,
    getPrices: async (uuid) => ({ printingId: uuid, cardKingdom: null, tcgPlayer: null }),
    getPriceHistory: async (uuid, days) => ({ printingId: uuid, days, cardKingdom: [], tcgPlayer: [] }),
    isReachable: async () => true,
    ...overrides,
  };
}

describe('ProviderRegistry', () => {
  test('getActive throws when no provider is active', () => {
    const r = new ProviderRegistry();
    expect(() => r.getActive()).toThrow(/No active provider set/);
  });

  test('register + setActive + getActive returns the registered provider', async () => {
    const r = new ProviderRegistry();
    const provider = makeProvider();
    r.register('test', provider);
    await r.setActive('test');
    expect(r.getActive()).toBe(provider);
  });

  test('setActive throws ProviderRegistryNotFoundError for unknown name', async () => {
    const r = new ProviderRegistry();
    await expect(
      () => r.setActive('unknown'),
    ).rejects.toThrow(ProviderRegistryNotFoundError);
  });

  test('setActive throws ProviderRegistryUnreachableError when isReachable returns false', async () => {
    const r = new ProviderRegistry();
    r.register('dead', makeProvider({ isReachable: async () => false }));
    await expect(
      () => r.setActive('dead'),
    ).rejects.toThrow(ProviderRegistryUnreachableError);
  });

  test('setActive keeps previous active provider when new one is unreachable', async () => {
    const r = new ProviderRegistry();
    const good = makeProvider();
    r.register('good', good);
    await r.setActive('good');

    r.register('dead', makeProvider({ isReachable: async () => false }));
    await expect(() => r.setActive('dead')).rejects.toThrow(ProviderRegistryUnreachableError);

    // Previous active should still be in place.
    expect(r.getActive()).toBe(good);
  });

  test('getProviderInfo returns active provider name and reachability', async () => {
    const r = new ProviderRegistry();
    r.register('mtgjson', makeProvider());
    await r.setActive('mtgjson');
    const info = await r.getProviderInfo();
    expect(info.name).toBe('mtgjson');
    expect(info.active).toBe(true);
    expect(info.reachable).toBe(true);
  });

  test('getProviderInfo returns reachable: false when provider is down', async () => {
    const r = new ProviderRegistry();
    // Register a provider that becomes unreachable after activation.
    let reachable = true;
    const provider = makeProvider({ isReachable: async () => reachable });
    r.register('flaky', provider);
    await r.setActive('flaky');

    reachable = false;
    const info = await r.getProviderInfo();
    expect(info.reachable).toBe(false);
  });

  test('getProviderInfo when no active provider', async () => {
    const r = new ProviderRegistry();
    const info = await r.getProviderInfo();
    expect(info.active).toBe(false);
    expect(info.reachable).toBe(false);
  });
});
