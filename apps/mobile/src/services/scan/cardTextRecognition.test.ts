import * as mlkit from '@infinitered/react-native-mlkit-text-recognition';
import { Platform } from 'react-native';

import { recognizeCardName, TextRecognitionError } from './cardTextRecognition';

const recognizedFixture = {
  text: 'Lightning Bolt',
  blocks: [
    {
      text: 'Lightning Bolt',
      frame: { left: 12, top: 16, right: 320, bottom: 64 },
      recognizedLanguages: ['en'],
      lines: [],
    },
  ],
};

describe('recognizeCardName', () => {
  let recognizeTextSpy: jest.SpyInstance<ReturnType<typeof mlkit.recognizeText>>;

  beforeEach(() => {
    recognizeTextSpy = jest.spyOn(mlkit, 'recognizeText');
    recognizeTextSpy.mockReset().mockResolvedValue(recognizedFixture);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('recognition pipeline (FR-004)', () => {
    it('delegates to recognizeText with the uri and returns the parsed candidates', async () => {
      const result = await recognizeCardName('file:///card.jpg');

      expect(recognizeTextSpy).toHaveBeenCalledWith('file:///card.jpg');
      expect(result).toEqual({ kind: 'recognized', candidateNames: ['Lightning Bolt'] });
    });

    it('returns every recognised line as an ordered candidate (top-most first)', async () => {
      recognizeTextSpy.mockResolvedValue({
        text: 'Survival of the Fittest\nEnchantment',
        blocks: [
          {
            text: 'Survival of the Fittest',
            frame: { left: 20, top: 40, right: 320, bottom: 90 },
            recognizedLanguages: ['en'],
            lines: [],
          },
          {
            text: 'Enchantment',
            frame: { left: 20, top: 100, right: 200, bottom: 130 },
            recognizedLanguages: ['en'],
            lines: [],
          },
        ],
      });

      await expect(recognizeCardName('file:///survival.jpg')).resolves.toEqual({
        kind: 'recognized',
        candidateNames: ['Survival of the Fittest', 'Enchantment'],
      });
    });

    it('returns noText when the heuristic finds no usable name', async () => {
      recognizeTextSpy.mockResolvedValue({ text: '', blocks: [] });

      await expect(recognizeCardName('file:///blank.jpg')).resolves.toEqual({ kind: 'noText' });
    });
  });

  describe('error transparency (Principle VIII)', () => {
    it('logs the original error and rethrows a typed TextRecognitionError with cause', async () => {
      const original = new Error('native boom');
      recognizeTextSpy.mockRejectedValue(original);
      const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      let thrown: unknown;
      try {
        await recognizeCardName('file:///card.jpg');
      } catch (error) {
        thrown = error;
      }

      expect(thrown).toBeInstanceOf(TextRecognitionError);
      expect((thrown as TextRecognitionError).code).toBe('TEXT_RECOGNITION_FAILED');
      expect((thrown as TextRecognitionError).cause).toBe(original);
      expect(errorSpy).toHaveBeenCalledWith(
        '[cardTextRecognition] recognizeText rejected',
        original,
      );
    });
  });

  describe('web guard (FR-008)', () => {
    it('returns unsupported and never calls the native module on web', async () => {
      jest.replaceProperty(Platform, 'OS', 'web');

      const result = await recognizeCardName('file:///card.jpg');

      expect(result).toEqual({ kind: 'unsupported' });
      expect(recognizeTextSpy).not.toHaveBeenCalled();
    });
  });
});
