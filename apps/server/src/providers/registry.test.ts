import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import type { CardProvider } from './interface';
import {
  ProviderRegistry,
  ProviderRegistryNotFoundError,
  ProviderRegistryUnreachableError,
} from './registry';

function makeProvider(overrides: Partial<CardProvider> = {}): CardProvider {
  return {
    lookup: async () => ({ found: false, name: 'test' }),
    checkLegality: async (name) => ({ cardName: name, legal: true, reason: null, colorIdentity: [] }),
    search: async () => [],
    isReachable: async () => true,
    ...overrides,
  };
}

describe('ProviderRegistry', () => {
  test('getActive throws when no provider is active', () => {
    const r = new ProviderRegistry();
    assert.throws(() => r.getActive(), /No active provider set/);
  });

  test('register + setActive + getActive returns the registered provider', async () => {
    const r = new ProviderRegistry();
    const provider = makeProvider();
    r.register('test', provider);
    await r.setActive('test');
    assert.equal(r.getActive(), provider);
  });

  test('setActive throws ProviderRegistryNotFoundError for unknown name', async () => {
    const r = new ProviderRegistry();
    await assert.rejects(
      () => r.setActive('unknown'),
      ProviderRegistryNotFoundError,
    );
  });

  test('setActive throws ProviderRegistryUnreachableError when isReachable returns false', async () => {
    const r = new ProviderRegistry();
    r.register('dead', makeProvider({ isReachable: async () => false }));
    await assert.rejects(
      () => r.setActive('dead'),
      ProviderRegistryUnreachableError,
    );
  });

  test('setActive keeps previous active provider when new one is unreachable', async () => {
    const r = new ProviderRegistry();
    const good = makeProvider();
    r.register('good', good);
    await r.setActive('good');

    r.register('dead', makeProvider({ isReachable: async () => false }));
    await assert.rejects(() => r.setActive('dead'), ProviderRegistryUnreachableError);

    // Previous active should still be in place.
    assert.equal(r.getActive(), good);
  });

  test('getProviderInfo returns active provider name and reachability', async () => {
    const r = new ProviderRegistry();
    r.register('mtgjson', makeProvider());
    await r.setActive('mtgjson');
    const info = await r.getProviderInfo();
    assert.equal(info.name, 'mtgjson');
    assert.equal(info.active, true);
    assert.equal(info.reachable, true);
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
    assert.equal(info.reachable, false);
  });

  test('getProviderInfo when no active provider', async () => {
    const r = new ProviderRegistry();
    const info = await r.getProviderInfo();
    assert.equal(info.active, false);
    assert.equal(info.reachable, false);
  });
});
