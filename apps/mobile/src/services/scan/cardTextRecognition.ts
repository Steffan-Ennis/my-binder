// Spec 022 — on-device OCR wrapper (Layer = Service: the only place the native
// `recognizeText` is touched). Full JSDoc per Principle IX. Returns a typed
// result for the expected paths; a genuine native failure is logged and
// rethrown as a typed `TextRecognitionError` (Principle VIII).
import { recognizeText } from '@infinitered/react-native-mlkit-text-recognition';
import { Platform } from 'react-native';

import { parseCardName } from '@src/utils/parseCardName';

/** Typed result of one card-name recognition attempt. */
export type CardTextRecognitionResult =
  | { kind: 'recognized'; candidateName: string }
  | { kind: 'noText' }
  | { kind: 'unsupported' };

/**
 * Thrown when the native recognizer rejects. The original error is logged and
 * attached as `cause` before this wrapper is thrown, so the failure is never
 * swallowed (Principle VIII).
 */
export class TextRecognitionError extends Error {
  readonly code = 'TEXT_RECOGNITION_FAILED';

  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'TextRecognitionError';
  }
}

/**
 * Recognise the most prominent card name from a captured image on-device.
 *
 * Guards `Platform.OS === 'web'` (no on-device recognizer exists there) and
 * never calls the native module on web. Otherwise it delegates to ML Kit's
 * `recognizeText`, runs the {@link parseCardName} heuristic, and returns a
 * typed result.
 *
 * @param uri - local file URI of the captured/imported still.
 * @returns `{ kind: 'recognized', candidateName }` on a confident read,
 *   `{ kind: 'noText' }` when nothing usable is found, or
 *   `{ kind: 'unsupported' }` on web.
 * @throws {TextRecognitionError} when the native recognizer rejects — the
 *   original error is logged first and attached as `cause`.
 *
 * @example
 *   const result = await recognizeCardName(photo.uri);
 *   if (result.kind === 'recognized') search(result.candidateName);
 */
export const recognizeCardName = async (uri: string): Promise<CardTextRecognitionResult> => {
  if (Platform.OS === 'web') {
    return { kind: 'unsupported' };
  }

  let recognized;
  try {
    recognized = await recognizeText(uri);
  } catch (error) {
    // Principle VIII — log the original cause before rethrowing the wrapper.
    console.error('[cardTextRecognition] recognizeText rejected', error);
    throw new TextRecognitionError('On-device text recognition failed', { cause: error });
  }

  const candidateName = parseCardName(recognized);
  return candidateName ? { kind: 'recognized', candidateName } : { kind: 'noText' };
};
