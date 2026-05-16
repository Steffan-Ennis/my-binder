import type { CardImages } from '@my-binder/core';

// Scryfall CDN convention: image paths shard by the first two characters of
// the Scryfall id. Sizes `small`, `normal`, `large` are the canonical raster
// JPG variants; the public `medium` key in `CardImages` maps to `normal` here.
const SIZES = { small: 'small', medium: 'normal', large: 'large' } as const;

/**
 * Build the three Scryfall image URLs (`small`, `medium`, `large`) for a printing.
 *
 * `medium` maps to Scryfall's `normal` size (488×680 JPG) — the rename happens
 * at this seam so callers can use a stable, friendly key set.
 *
 * @param scryfallId - Scryfall printing identifier (UUID-shaped string).
 * @returns A `CardImages` object, or `null` when `scryfallId` is shorter than
 *   the two characters required for CDN path sharding.
 *
 * @example
 * ```ts
 * buildScryfallImageUrls('e3285fd6-aaaa-bbbb-cccc-ddddddddeeee');
 * // {
 * //   small:  'https://cards.scryfall.io/small/front/e/3/e3285fd6-....jpg',
 * //   medium: 'https://cards.scryfall.io/normal/front/e/3/e3285fd6-....jpg',
 * //   large:  'https://cards.scryfall.io/large/front/e/3/e3285fd6-....jpg',
 * // }
 *
 * buildScryfallImageUrls(''); // null
 * ```
 */
const buildScryfallImageUrls = (scryfallId: string): CardImages | null => {
  if (scryfallId.length < 2) return null;
  const c1 = scryfallId[0];
  const c2 = scryfallId[1];
  const url = (size: string): string =>
    `https://cards.scryfall.io/${size}/front/${c1}/${c2}/${scryfallId}.jpg`;
  return {
    small: url(SIZES.small),
    medium: url(SIZES.medium),
    large: url(SIZES.large),
  };
}

export default buildScryfallImageUrls
