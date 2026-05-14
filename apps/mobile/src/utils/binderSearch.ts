import type { Card } from '@my-binder/core';

const TOKEN_SPLIT = /\s+/;

/**
 * Filter the user's binder cards by the binder-search query.
 *
 * Semantics (spec 016 FR-005a):
 * - Empty / whitespace-only query → return the input array unchanged (no filter).
 * - Otherwise: split the query on whitespace into tokens, lowercase each token,
 *   then for every card build a single lowercased haystack of
 *   `name + " " + (setName ?? "") + " " + (setCode ?? "") + " " + (typeLine ?? "")`.
 * - A card matches iff EVERY token is a substring of the haystack — each token
 *   may match independently against any of the four fields. There is no
 *   per-field weighting, ranking, or quoted-phrase syntax.
 *
 * Pure function (research §4): no side effects, no I/O, no caching.
 *
 * @param cards - the user's collection (typically the unfiltered TanStack-cached array)
 * @param query - the raw text from the inline search input
 * @returns the matching subset (in input order); identity-equal to `cards` when the query is inactive
 *
 * @example
 *   binderSearch(cards, '');                    // identity-equal to cards
 *   binderSearch(cards, '   ');                 // identity-equal to cards
 *   binderSearch(cards, 'bolt');                // [Lightning Bolt]
 *   binderSearch(cards, 'red creature');        // every card whose name+set+type contains "red" AND "creature"
 */
export const binderSearch = (
  cards: ReadonlyArray<Card>,
  query: string,
): ReadonlyArray<Card> => {
  const trimmed = query.trim();
  if (trimmed.length === 0) return cards;

  const tokens = trimmed.toLowerCase().split(TOKEN_SPLIT);

  return cards.filter((card) => {
    const haystack = [
      card.name,
      card.setName ?? '',
      card.setCode ?? '',
      card.typeLine ?? '',
    ]
      .join(' ')
      .toLowerCase();
    return tokens.every((token) => haystack.includes(token));
  });
};
