// Spec 022 — pure name heuristic (Layer = Utility: no React, no side effects).
// The on-device recognizer hands us a `Text` result; we reduce it to a
// best-guess card name. The recognizer's full `Text`/`Block` shape is NOT
// imported here so the util stays pure and trivially testable — we consume the
// minimal local shape below, which the native `Text` is structurally
// assignable to.

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

const cleanName = (raw: string): string => {
  const firstLine =
    raw
      .split(/\r?\n/)
      .map((line) => line.trim())
      .find((line) => line.length > 0) ?? '';

  const cleaned = firstLine
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
  area: number;
  top: number;
  index: number;
};

const frameArea = (frame?: RecognizedFrame): number =>
  frame ? Math.max(0, frame.right - frame.left) * Math.max(0, frame.bottom - frame.top) : 0;

/**
 * Reduce a recognised `Text` result to the most likely card name, or
 * `undefined` when nothing usable is present.
 *
 * Heuristic (deliberately simple, per research D5): clean each block to a
 * candidate name, discard the empties, then pick the **most prominent** block —
 * largest frame area, tie-broken by the top-most block. Set-symbol and
 * collector-number noise is stripped; non-Latin / garbage yields `undefined`.
 */
export const parseCardName = (recognizedText: RecognizedText): string | undefined => {
  const candidates: Candidate[] = [];

  recognizedText.blocks.forEach((block, index) => {
    const name = cleanName(block.text);
    if (name.length === 0) return;
    candidates.push({
      name,
      area: frameArea(block.frame),
      top: block.frame ? block.frame.top : Number.POSITIVE_INFINITY,
      index,
    });
  });

  if (candidates.length === 0) return undefined;

  candidates.sort((a, b) => {
    if (b.area !== a.area) return b.area - a.area; // largest frame first
    if (a.top !== b.top) return a.top - b.top; // tie-break: top-most
    return a.index - b.index; // stable: first block wins
  });

  return candidates[0]!.name;
};
