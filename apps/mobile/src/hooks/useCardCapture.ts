// Spec 022 — shared capture hook (Layer = Shared hook: the ONLY place
// `expo-camera` / `expo-image-picker` are touched). Surfaces the camera ref,
// permission state, still capture, gallery import, and torch toggle as typed
// results. Reused by plan B's Multi mode. Every returned function is
// `useCallback`-wrapped and `cameraRef` is reference-stable (memoisation rule).
import { CameraView, useCameraPermissions } from 'expo-camera';
import { launchImageLibraryAsync } from 'expo-image-picker';
import type { RefObject } from 'react';
import { useCallback, useRef, useState } from 'react';
import { Platform } from 'react-native';

/** Typed outcome of a capture / gallery-import attempt (never a thrown control flow). */
export type CaptureResult =
  | { kind: 'captured'; uri: string }
  | { kind: 'denied' }
  | { kind: 'cancelled' }
  | { kind: 'unsupported' };

/** Camera permission, normalised to the three states the UI cares about. */
export type CameraPermissionStatus = 'granted' | 'denied' | 'undetermined';

export type UseCardCaptureResult = {
  cameraRef: RefObject<CameraView | null>;
  permissionStatus: CameraPermissionStatus;
  requestPermission: () => Promise<void>;
  capture: () => Promise<CaptureResult>;
  pickFromLibrary: () => Promise<CaptureResult>;
  torchEnabled: boolean;
  toggleTorch: () => void;
};

// Half-quality stills keep the recognizer fast without hurting OCR accuracy
// (Principle V — no magic literal).
const CAPTURE_QUALITY = 0.5;

type PermissionLike = { granted: boolean; status: string } | null;

const toPermissionStatus = (permission: PermissionLike): CameraPermissionStatus => {
  if (!permission) return 'undetermined';
  if (permission.granted) return 'granted';
  if (permission.status === 'denied') return 'denied';
  return 'undetermined';
};

/**
 * Camera permission + `CameraView` ref + still capture + gallery import + torch.
 * The `cameraRef` is handed to the View's `<CameraView ref={…} />`; `capture()`
 * reads it to take the still.
 */
export const useCardCapture = (): UseCardCaptureResult => {
  const cameraRef = useRef<CameraView | null>(null);
  const [permission, requestCameraPermission] = useCameraPermissions();
  const [torchEnabled, setTorchEnabled] = useState(false);

  const permissionStatus = toPermissionStatus(permission);

  const requestPermission = useCallback(async (): Promise<void> => {
    await requestCameraPermission();
  }, [requestCameraPermission]);

  const ensurePermission = useCallback(async (): Promise<boolean> => {
    if (permission?.granted) return true;
    const response = await requestCameraPermission();
    return response.granted;
  }, [permission, requestCameraPermission]);

  const capture = useCallback(async (): Promise<CaptureResult> => {
    if (Platform.OS === 'web') return { kind: 'unsupported' };

    const granted = await ensurePermission();
    if (!granted) return { kind: 'denied' };

    const camera = cameraRef.current;
    if (!camera) return { kind: 'unsupported' };

    const picture = await camera.takePictureAsync({ quality: CAPTURE_QUALITY });
    return { kind: 'captured', uri: picture.uri };
  }, [ensurePermission]);

  const pickFromLibrary = useCallback(async (): Promise<CaptureResult> => {
    const result = await launchImageLibraryAsync({ mediaTypes: 'images', quality: CAPTURE_QUALITY });
    if (result.canceled || result.assets.length === 0) return { kind: 'cancelled' };
    return { kind: 'captured', uri: result.assets[0]!.uri };
  }, []);

  const toggleTorch = useCallback(() => {
    setTorchEnabled((prev) => !prev);
  }, []);

  return {
    cameraRef,
    permissionStatus,
    requestPermission,
    capture,
    pickFromLibrary,
    torchEnabled,
    toggleTorch,
  };
};
