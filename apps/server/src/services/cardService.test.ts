import { test, describe, before } from 'node:test';
import assert from 'node:assert/strict';
import type { CardProvider } from '@src/providers/interface';
import { registry } from '@src/providers/registry';
import {
  lookupCard,
  checkCommanderLegality,
  searchCards,
  CardNotFoundError,
  ProviderUnavailableError,
} from './cardService';
import type { CardRecord } from '@my-binder/core';

const LIGHTNING_BOLT: CardRecord = {
  name: 'Lightning Bolt',
  set: 'M11',
  cardNumber: '149',
  manaCost: '{R}',
  colorIdentity: ['R'],
  commanderLegal: true,
  imageRef: null,
};

const SOL_RING: CardRecord = {
  name: 'Sol Ring',
  set: 'C11',
  cardNumber: '58',
  manaCost: '{1}',
  colorIdentity: [],
  commanderLegal: true,
  imageRef: null,
};

function makeProvider(overrides: Partial<CardProvider> = {}): CardProvider {
  return {
    lookup: async () => [LIGHTNING_BOLT],
    checkLegality: async (name) => ({ cardName: name, legal: true, reason: null, colorIdentity: [] }),
    search: async () => [LIGHTNING_BOLT, SOL_RING],
    isReachable: async () => true,
    ...overrides,
  };
}

describe('cardService — provider-backed functions', () => {
  before(async () => {
    registry.register('test', makeProvider());
    await registry.setActive('test');
  });

  // ─── lookupCard ─────────────────────────────────────────────────────────────

  describe('lookupCard', () => {
    test('returns CardRecord array when cards are found', async () => {
      const result = await lookupCard('Lightning Bolt');
      assert.ok(Array.isArray(result));
      assert.equal((result as CardRecord[])[0]?.name, 'Lightning Bolt');
    });

    test('returns CardNotFoundResult when no match', async () => {
      registry.register('notfound', makeProvider({
        lookup: async (name) => ({ found: false, name }),
      }));
      await registry.setActive('notfound');

      const result = await lookupCard('ZZZFake');
      assert.ok(!Array.isArray(result));
      assert.equal((result as { found: boolean }).found, false);

      // Restore
      await registry.setActive('test');
    });

    test('throws ProviderUnavailableError when provider errors', async () => {
      registry.register('broken', makeProvider({
        lookup: async () => { throw new Error('connection lost'); },
        isReachable: async () => true,
      }));
      await registry.setActive('broken');

      await assert.rejects(() => lookupCard('anything'), ProviderUnavailableError);

      await registry.setActive('test');
    });

    test('passes set option through to provider', async () => {
      let capturedOpts: Parameters<CardProvider['lookup']>[1] = {};
      registry.register('set-test', makeProvider({
        lookup: async (_name, opts) => {
          capturedOpts = opts ?? {};
          return [LIGHTNING_BOLT];
        },
      }));
      await registry.setActive('set-test');

      await lookupCard('Lightning Bolt', { set: 'M11' });
      assert.equal(capturedOpts.set, 'M11');

      await registry.setActive('test');
    });

    test('passes number option through to provider', async () => {
      let capturedOpts: Parameters<CardProvider['lookup']>[1] = {};
      registry.register('number-test', makeProvider({
        lookup: async (_name, opts) => {
          capturedOpts = opts ?? {};
          return [LIGHTNING_BOLT];
        },
      }));
      await registry.setActive('number-test');

      await lookupCard('Lightning Bolt', { set: 'M11', number: '149' });
      assert.equal(capturedOpts.set, 'M11');
      assert.equal(capturedOpts.number, '149');

      await registry.setActive('test');
    });
  });

  // ─── checkCommanderLegality ─────────────────────────────────────────────────

  describe('checkCommanderLegality', () => {
    test('returns legal result for a legal card', async () => {
      registry.register('legal', makeProvider({
        checkLegality: async (name) => ({ cardName: name, legal: true, reason: null, colorIdentity: [] }),
      }));
      await registry.setActive('legal');

      const result = await checkCommanderLegality('Sol Ring');
      assert.equal(result.legal, true);
      assert.equal(result.reason, null);
    });

    test('returns banned result', async () => {
      registry.register('banned-test', makeProvider({
        checkLegality: async (name) => ({
          cardName: name, legal: false, reason: 'Banned in Commander', colorIdentity: [],
        }),
      }));
      await registry.setActive('banned-test');

      const result = await checkCommanderLegality('Black Lotus');
      assert.equal(result.legal, false);
      assert.equal(result.reason, 'Banned in Commander');
    });

    test('throws CardNotFoundError when provider throws CARD_NOT_FOUND', async () => {
      registry.register('missing-card', makeProvider({
        checkLegality: async (name) => {
          throw Object.assign(new Error(`No card found with name "${name}".`), { code: 'CARD_NOT_FOUND' });
        },
      }));
      await registry.setActive('missing-card');

      await assert.rejects(() => checkCommanderLegality('Nonexistent Card'), CardNotFoundError);
    });

    test('throws ProviderUnavailableError when provider errors with non-CARD_NOT_FOUND', async () => {
      registry.register('unavailable', makeProvider({
        checkLegality: async () => { throw new Error('timeout'); },
      }));
      await registry.setActive('unavailable');

      await assert.rejects(() => checkCommanderLegality('Any Card'), ProviderUnavailableError);
    });
  });

  // ─── searchCards ────────────────────────────────────────────────────────────

  describe('searchCards', () => {
    before(async () => {
      registry.register('search', makeProvider({
        search: async () => Array.from({ length: 45 }, (_, i) => ({
          ...LIGHTNING_BOLT, name: `Card ${i + 1}`, cardNumber: String(i + 1),
        })),
      }));
      await registry.setActive('search');
    });

    test('returns paginated SearchResult', async () => {
      const result = await searchCards({ name: 'Card', page: 1, limit: 20 });
      assert.equal(result.total, 45);
      assert.equal(result.page, 1);
      assert.equal(result.limit, 20);
      assert.equal(result.totalPages, 3);
      assert.equal(result.cards.length, 20);
    });

    test('returns correct slice for page 2', async () => {
      const result = await searchCards({ name: 'Card', page: 2, limit: 20 });
      assert.equal(result.cards.length, 20);
      assert.equal(result.cards[0]?.name, 'Card 21');
    });

    test('returns correct partial last page', async () => {
      const result = await searchCards({ name: 'Card', page: 3, limit: 20 });
      assert.equal(result.cards.length, 5);
    });

    test('defaults page=1 and limit=20', async () => {
      const result = await searchCards({ name: 'Card' });
      assert.equal(result.page, 1);
      assert.equal(result.limit, 20);
    });

    test('caps limit at 100', async () => {
      const result = await searchCards({ name: 'Card', limit: 999 });
      assert.equal(result.limit, 100);
    });

    test('returns totalPages=0 for empty result set', async () => {
      registry.register('empty', makeProvider({ search: async () => [] }));
      await registry.setActive('empty');

      const result = await searchCards({ name: 'nothing' });
      assert.equal(result.total, 0);
      assert.equal(result.totalPages, 0);
      assert.deepEqual(result.cards, []);

      await registry.setActive('search');
    });

    test('throws ProviderUnavailableError when provider errors', async () => {
      registry.register('search-broken', makeProvider({
        search: async () => { throw new Error('disk error'); },
      }));
      await registry.setActive('search-broken');

      await assert.rejects(() => searchCards({ name: 'x' }), ProviderUnavailableError);
    });
  });
});
