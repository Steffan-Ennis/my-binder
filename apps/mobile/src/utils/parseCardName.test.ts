import {
  parseCardName,
  parseCardNameCandidates,
  type RecognizedFrame,
  type RecognizedText,
} from './parseCardName';

const frame = (left: number, top: number, right: number, bottom: number): RecognizedFrame => ({
  left,
  top,
  right,
  bottom,
});

const text = (blocks: RecognizedText['blocks'], joined = ''): RecognizedText => ({
  text: joined,
  blocks,
});

describe('parseCardName', () => {
  describe('empty / no usable text (FR-004)', () => {
    it('returns undefined when there are no blocks', () => {
      expect(parseCardName(text([]))).toBeUndefined();
    });

    it('returns undefined when every block cleans to empty (only noise)', () => {
      expect(
        parseCardName(text([{ text: '233/250', frame: frame(0, 0, 40, 12) }])),
      ).toBeUndefined();
    });

    it('returns undefined when a block holds only whitespace', () => {
      expect(
        parseCardName(text([{ text: '   \n  \t ', frame: frame(0, 0, 40, 12) }])),
      ).toBeUndefined();
    });

    it('returns undefined for non-Latin / garbage text', () => {
      expect(
        parseCardName(text([{ text: '日本語のテキスト', frame: frame(0, 0, 200, 40) }])),
      ).toBeUndefined();
    });
  });

  describe('single block', () => {
    it('returns the single block line, trimmed', () => {
      expect(
        parseCardName(text([{ text: '  Lightning Bolt  ', frame: frame(10, 10, 200, 50) }])),
      ).toBe('Lightning Bolt');
    });

    it('reduces a multi-line block to its first usable line', () => {
      expect(
        parseCardName(text([{ text: '\nCounterspell\nInstant', frame: frame(10, 10, 200, 50) }])),
      ).toBe('Counterspell');
    });
  });

  describe('top-most wins (the card name sits highest)', () => {
    it('picks the higher block over a lower one regardless of size', () => {
      const result = parseCardName(
        text([
          { text: 'Common', frame: frame(0, 200, 60, 220) }, // small, low
          { text: 'Lightning Bolt', frame: frame(10, 10, 300, 70) }, // larger, high
        ]),
      );
      expect(result).toBe('Lightning Bolt');
    });

    it('prefers the top-most title over a larger rules-text block lower down (Mishra\'s Workshop bug)', () => {
      const result = parseCardName(
        text([
          // The rules box is physically larger but sits below the title — the old
          // "largest frame area" heuristic wrongly picked this block.
          {
            text: 'Tap to add three colorless mana to your mana pool.',
            frame: frame(20, 300, 360, 520),
          },
          { text: "Mishra's Workshop", frame: frame(20, 40, 300, 90) },
        ]),
      );
      expect(result).toBe("Mishra's Workshop");
    });

    it('breaks a top tie by keeping the first block (stable order)', () => {
      const result = parseCardName(
        text([
          { text: 'First Block', frame: frame(0, 10, 100, 50) },
          { text: 'Second Block', frame: frame(0, 10, 100, 50) },
        ]),
      );
      expect(result).toBe('First Block');
    });
  });

  describe('noise stripping', () => {
    it('strips a collector-number fraction', () => {
      expect(
        parseCardName(text([{ text: 'Black Lotus 233/250', frame: frame(10, 10, 300, 60) }])),
      ).toBe('Black Lotus');
    });

    it('strips a trailing standalone collector number', () => {
      expect(
        parseCardName(text([{ text: 'Plains 250', frame: frame(10, 10, 300, 60) }])),
      ).toBe('Plains');
    });

    it('strips a set-symbol glyph', () => {
      expect(
        parseCardName(text([{ text: 'Lightning Bolt ✦', frame: frame(10, 10, 300, 60) }])),
      ).toBe('Lightning Bolt');
    });
  });

  describe('frameless blocks', () => {
    it('still returns a name when blocks carry no frame', () => {
      expect(parseCardName(text([{ text: 'Giant Growth' }]))).toBe('Giant Growth');
    });
  });
});

describe('parseCardNameCandidates', () => {
  it('returns [] when nothing usable is present', () => {
    expect(parseCardNameCandidates(text([]))).toEqual([]);
    expect(parseCardNameCandidates(text([{ text: '233/250', frame: frame(0, 0, 40, 12) }]))).toEqual(
      [],
    );
  });

  it('returns every usable line ordered top-most first', () => {
    // Mirrors the real "Survival of the Fittest" read: title, type line, then
    // rules text — placement may vary, so every line becomes a candidate.
    const result = parseCardNameCandidates(
      text([
        { text: 'Survival of the Fittest', frame: frame(20, 40, 320, 90) },
        { text: 'Enchantment', frame: frame(20, 100, 200, 130) },
        { text: 'Choose and discard a creature', frame: frame(20, 300, 360, 520) },
      ]),
    );
    expect(result).toEqual([
      'Survival of the Fittest',
      'Enchantment',
      'Choose and discard a creature',
    ]);
  });

  it('splits a multi-line block into per-line candidates in reading order', () => {
    const result = parseCardNameCandidates(
      text([{ text: 'Survival of the Fittest\nEnchantment', frame: frame(20, 40, 320, 130) }]),
    );
    expect(result).toEqual(['Survival of the Fittest', 'Enchantment']);
  });

  it('de-duplicates repeated names case-insensitively, keeping the first', () => {
    const result = parseCardNameCandidates(
      text([
        { text: 'Forest', frame: frame(0, 10, 100, 40) },
        { text: 'forest', frame: frame(0, 200, 100, 230) },
      ]),
    );
    expect(result).toEqual(['Forest']);
  });

  it('orders the real card name ahead of its larger rules block', () => {
    const result = parseCardNameCandidates(
      text([
        {
          text: 'Tap to add three colorless mana to your mana pool.',
          frame: frame(20, 300, 360, 520),
        },
        { text: "Mishra's Workshop", frame: frame(20, 40, 300, 90) },
      ]),
    );
    expect(result[0]).toBe("Mishra's Workshop");
  });
});
