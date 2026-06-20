// Spec 022 — pure name heuristic (Layer = Utility: no React, no side effects).
// The on-device recognizer hands us a `Text` result; we reduce it to an ordered
// list of candidate names (most name-like first) so the caller can try each one
// against the catalogue rather than betting everything on a single block. The
// recognizer's full `Text`/`Block` shape is NOT imported here so the util stays
// pure and trivially testable — we consume the minimal local shape below, which
// the native `Text` is structurally assignable to.

/** Pixel rectangle of a recognised block, mirroring ML Kit's `Rect`. */
export type RecognizedFrame = {
  left: number;
  top: number;
  right: number;
  bottom: number;
};

/** One recognised text block — only the fields the heuristic needs. */
export type RecognizedBlock = {
  text: string;
  frame?: RecognizedFrame;
};

/** Minimal local view of ML Kit's `Text` result the heuristic consumes. */
export type RecognizedText = {
  text: string;
  blocks: ReadonlyArray<RecognizedBlock>;
};

const LATIN_LETTER = /[A-Za-z]/;
// "123/250" collector-number form.
const COLLECTOR_FRACTION = /\b\d+\s*\/\s*\d+\b/g;
// Anything outside the small alphabet a card name uses — this also drops
// non-Latin scripts (Cyrillic/CJK) and set-symbol glyphs to whitespace.
const NON_NAME_CHARS = /[^A-Za-z0-9\s'’,.&!:\-]/g;
// A standalone integer token (a bare collector number / set count).
const STANDALONE_NUMBER = /(^|\s)\d+(?=\s|$)/g;

const cleanLine = (raw: string): string => {
  const cleaned = raw
    .replace(COLLECTOR_FRACTION, ' ')
    .replace(NON_NAME_CHARS, ' ')
    .replace(STANDALONE_NUMBER, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  // No Latin letters left → garbage / non-Latin script → not a usable name.
  return LATIN_LETTER.test(cleaned) ? cleaned : '';
};

type Candidate = {
  name: string;
  top: number;
  blockIndex: number;
  lineIndex: number;
};

/**
 * Reduce a recognised `Text` result to an ordered list of candidate card names.
 *
 * Every non-empty line of every block becomes a candidate (set-symbol and
 * collector-number noise stripped; non-Latin / garbage dropped). Candidates are
 * ordered **top-most first** — a card's printed name sits at the top, so the
 * highest line is the most likely name — then by block and line order; the list
 * is de-duplicated case-insensitively.
 *
 * The caller tries each candidate against the catalogue and keeps the first that
 * matches. This is deliberate: a card whose largest text block is its rules box
 * (e.g. Mishra's Workshop) would otherwise resolve to its reminder text, and a
 * card name that is not the first recognised block (placement varies) would be
 * missed if only the single most-prominent block were used.
 *
 * @param recognizedText - the minimal `Text` shape the on-device recognizer returns.
 * @returns candidate names, most name-like first; `[]` when nothing usable is found.
 *
 * @example
 *   const names = parseCardNameCandidates(recognized); // ['Survival of the Fittest', 'Enchantment', …]
 *   for (const name of names) if (await catalogueHasMatch(name)) return name;
 */
export const parseCardNameCandidates = (recognizedText: RecognizedText): string[] => {
  const candidates: Candidate[] = [];

  recognizedText.blocks.forEach((block, blockIndex) => {
    const top = block.frame ? block.frame.top : Number.POSITIVE_INFINITY;
    block.text.split(/\r?\n/).forEach((line, lineIndex) => {
      const name = cleanLine(line);
      if (name.length === 0) return;
      candidates.push({ name, top, blockIndex, lineIndex });
    });
  });

  candidates.sort((a, b) => {
    if (a.top !== b.top) return a.top - b.top; // top-most first (the name sits highest)
    if (a.blockIndex !== b.blockIndex) return a.blockIndex - b.blockIndex;
    return a.lineIndex - b.lineIndex; // stable, top-to-bottom within a block
  });

  const seen = new Set<string>();
  const ordered: string[] = [];
  candidates.forEach((candidate) => {
    const key = candidate.name.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    ordered.push(candidate.name);
  });
  return ordered;
};

/**
 * The single best-guess card name — the top-most usable line — or `undefined`
 * when nothing usable is present. Convenience accessor over
 * {@link parseCardNameCandidates}.
 */
export const parseCardName = (recognizedText: RecognizedText): string | undefined =>
  parseCardNameCandidates(recognizedText)[0];
