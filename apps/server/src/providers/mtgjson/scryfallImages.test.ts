import { buildScryfallImageUrls } from './scryfallImages';

describe('buildScryfallImageUrls', () => {
  test('returns small, medium, large URLs sharded by first two characters', () => {
    const id = 'e3285fd6-aaaa-bbbb-cccc-ddddddddeeee';
    const urls = buildScryfallImageUrls(id);

    expect(urls).toEqual({
      small: `https://cards.scryfall.io/small/front/e/3/${id}.jpg`,
      medium: `https://cards.scryfall.io/normal/front/e/3/${id}.jpg`,
      large: `https://cards.scryfall.io/large/front/e/3/${id}.jpg`,
    });
  });

  test('medium key maps to Scryfall normal size', () => {
    const urls = buildScryfallImageUrls('ab12');
    expect(urls?.medium).toContain('/normal/');
    expect(urls?.medium).not.toContain('/medium/');
  });

  test('returns null when scryfallId is empty', () => {
    expect(buildScryfallImageUrls('')).toBeNull();
  });

  test('returns null when scryfallId is a single character', () => {
    expect(buildScryfallImageUrls('a')).toBeNull();
  });
});