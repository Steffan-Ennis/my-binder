import { parseCardName, type RecognizedFrame, type RecognizedText } from './parseCardName';

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

    it('reduces a multi-line block to its first non-empty line', () => {
      expect(
        parseCardName(text([{ text: '\nCounterspell\nInstant', frame: frame(10, 10, 200, 50) }])),
      ).toBe('Counterspell');
    });
  });

  describe('multi-block prominence', () => {
    it('picks the block with the largest frame area', () => {
      const result = parseCardName(
        text([
          { text: 'Common', frame: frame(0, 200, 60, 220) }, // tiny
          { text: 'Lightning Bolt', frame: frame(10, 10, 300, 70) }, // large
        ]),
      );
      expect(result).toBe('Lightning Bolt');
    });

    it('breaks an area tie by choosing the top-most block', () => {
      const result = parseCardName(
        text([
          { text: 'Lower Banner', frame: frame(0, 100, 100, 140) }, // area 100*40
          { text: 'Upper Title', frame: frame(0, 10, 100, 50) }, // same area, higher
        ]),
      );
      expect(result).toBe('Upper Title');
    });

    it('breaks an area+top tie by keeping the first block (stable order)', () => {
      const result = parseCardName(
        text([
          { text: 'First Block', frame: frame(0, 10, 100, 50) }, // area 100*40, top 10
          { text: 'Second Block', frame: frame(0, 10, 100, 50) }, // identical area + top
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
