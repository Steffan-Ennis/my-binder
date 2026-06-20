import { CameraView } from 'expo-camera';
import * as ExpoCamera from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { act, renderHook } from '@testing-library/react-native';
import { Platform } from 'react-native';

import { useCardCapture, type CaptureResult } from './useCardCapture';

const grantedPermission = { granted: true, status: 'granted', canAskAgain: true };
const deniedPermission = { granted: false, status: 'denied', canAskAgain: true };

describe('useCardCapture', () => {
  let useCameraPermissionsSpy: jest.SpyInstance<ReturnType<typeof ExpoCamera.useCameraPermissions>>;
  let launchImageLibrarySpy: jest.SpyInstance<
    ReturnType<typeof ImagePicker.launchImageLibraryAsync>
  >;
  let requestPermissionMock: jest.Mock;

  // Override the shared `useCameraPermissions` mock (jest.setup.ts) with a
  // specific permission state, wiring `requestPermissionMock` as its request fn.
  const setPermission = (permission: { granted: boolean; status: string } | null) => {
    useCameraPermissionsSpy.mockReturnValue([
      permission,
      requestPermissionMock,
      requestPermissionMock,
    ] as unknown as ReturnType<typeof ExpoCamera.useCameraPermissions>);
  };

  const resolvePick = (pick: unknown) => {
    launchImageLibrarySpy.mockResolvedValue(
      pick as Awaited<ReturnType<typeof ImagePicker.launchImageLibraryAsync>>,
    );
  };

  beforeEach(() => {
    requestPermissionMock = jest.fn(async () => grantedPermission);
    useCameraPermissionsSpy = jest.spyOn(ExpoCamera, 'useCameraPermissions');
    launchImageLibrarySpy = jest.spyOn(ImagePicker, 'launchImageLibraryAsync');
    setPermission(grantedPermission);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('permission status', () => {
    it('reflects a granted permission', () => {
      const { result } = renderHook(() => useCardCapture());
      expect(result.current.permissionStatus).toBe('granted');
    });

    it('reflects a denied permission', () => {
      setPermission(deniedPermission);
      const { result } = renderHook(() => useCardCapture());
      expect(result.current.permissionStatus).toBe('denied');
    });

    it('reports undetermined when permission is null', () => {
      setPermission(null);
      const { result } = renderHook(() => useCardCapture());
      expect(result.current.permissionStatus).toBe('undetermined');
    });

    it('reports undetermined when not granted and not explicitly denied', () => {
      setPermission({ granted: false, status: 'undetermined' });
      const { result } = renderHook(() => useCardCapture());
      expect(result.current.permissionStatus).toBe('undetermined');
    });

    it('requestPermission delegates to the camera permission request', async () => {
      const { result } = renderHook(() => useCardCapture());
      await act(async () => {
        await result.current.requestPermission();
      });
      expect(requestPermissionMock).toHaveBeenCalledTimes(1);
    });
  });

  describe('capture (FR-003 / FR-007)', () => {
    it('captures a still with quality 0.5 when permission is granted', async () => {
      const takePictureAsync = jest.fn(async () => ({ uri: 'file:///shot.jpg' }));
      const { result } = renderHook(() => useCardCapture());
      result.current.cameraRef.current = { takePictureAsync } as unknown as CameraView;

      let outcome: CaptureResult | undefined;
      await act(async () => {
        outcome = await result.current.capture();
      });

      expect(takePictureAsync).toHaveBeenCalledWith({ quality: 0.5 });
      expect(outcome).toEqual({ kind: 'captured', uri: 'file:///shot.jpg' });
    });

    it('requests permission and returns denied when it is refused', async () => {
      requestPermissionMock = jest.fn(async () => deniedPermission);
      setPermission(deniedPermission);
      const { result } = renderHook(() => useCardCapture());

      let outcome: CaptureResult | undefined;
      await act(async () => {
        outcome = await result.current.capture();
      });

      expect(requestPermissionMock).toHaveBeenCalledTimes(1);
      expect(outcome).toEqual({ kind: 'denied' });
    });

    it('returns unsupported when granted but no camera is mounted', async () => {
      const { result } = renderHook(() => useCardCapture());

      let outcome: CaptureResult | undefined;
      await act(async () => {
        outcome = await result.current.capture();
      });

      expect(outcome).toEqual({ kind: 'unsupported' });
    });

    it('returns unsupported on web (FR-008)', async () => {
      jest.replaceProperty(Platform, 'OS', 'web');
      const { result } = renderHook(() => useCardCapture());

      let outcome: CaptureResult | undefined;
      await act(async () => {
        outcome = await result.current.capture();
      });

      expect(outcome).toEqual({ kind: 'unsupported' });
    });
  });

  describe('pickFromLibrary', () => {
    it('returns the picked asset uri', async () => {
      resolvePick({ canceled: false, assets: [{ uri: 'file:///pick.jpg' }] });
      const { result } = renderHook(() => useCardCapture());

      let outcome: CaptureResult | undefined;
      await act(async () => {
        outcome = await result.current.pickFromLibrary();
      });

      expect(outcome).toEqual({ kind: 'captured', uri: 'file:///pick.jpg' });
    });

    it('returns cancelled when the picker is dismissed', async () => {
      resolvePick({ canceled: true, assets: null });
      const { result } = renderHook(() => useCardCapture());

      let outcome: CaptureResult | undefined;
      await act(async () => {
        outcome = await result.current.pickFromLibrary();
      });

      expect(outcome).toEqual({ kind: 'cancelled' });
    });

    it('returns cancelled when the picker yields no assets', async () => {
      resolvePick({ canceled: false, assets: [] });
      const { result } = renderHook(() => useCardCapture());

      let outcome: CaptureResult | undefined;
      await act(async () => {
        outcome = await result.current.pickFromLibrary();
      });

      expect(outcome).toEqual({ kind: 'cancelled' });
    });
  });

  describe('torch + ref stability (FR-010 / memoisation rule)', () => {
    it('toggles the torch flag', () => {
      const { result } = renderHook(() => useCardCapture());
      expect(result.current.torchEnabled).toBe(false);

      act(() => result.current.toggleTorch());
      expect(result.current.torchEnabled).toBe(true);

      act(() => result.current.toggleTorch());
      expect(result.current.torchEnabled).toBe(false);
    });

    it('keeps cameraRef reference-stable across renders', () => {
      const { result, rerender } = renderHook(() => useCardCapture());
      const firstRef = result.current.cameraRef;
      rerender({});
      expect(result.current.cameraRef).toBe(firstRef);
    });
  });
});
