// The three permissions on the Permissions screen (FR-ONB-05). Each system prompt appears only when its Allow
// is tapped, after the card has said why; nothing here asks on its own. Camera and Photos use expo-image-picker's
// permission calls (the camera permission is the same app-wide one vision-camera reads).
import * as ImagePicker from 'expo-image-picker';
import * as Notifications from 'expo-notifications';
import { IosAuthorizationStatus } from 'expo-notifications';

export const PERMISSIONS = ['camera', 'photos', 'notifications'] as const;
export type PermissionKind = (typeof PERMISSIONS)[number];

/** `ask`: the system prompt can still be shown; `blocked`: denied for good, only Settings can turn it on. */
export type PermissionState = 'granted' | 'ask' | 'blocked';

type Response = { granted: boolean; canAskAgain: boolean; ios?: { status: IosAuthorizationStatus } };

function toState(r: Response): PermissionState {
  // Limited photo access and provisional notifications count as allowed.
  if (r.granted || r.ios?.status === IosAuthorizationStatus.PROVISIONAL) return 'granted';
  return r.canAskAgain ? 'ask' : 'blocked';
}

export type PermissionApi = {
  /** Reads the current state without asking. */
  read: (kind: PermissionKind) => Promise<PermissionState>;
  /** Shows the system prompt (when it still can) and resolves with the new state. */
  request: (kind: PermissionKind) => Promise<PermissionState>;
};

export const expoPermissionApi: PermissionApi = {
  read: async (kind) =>
    toState(
      kind === 'camera'
        ? await ImagePicker.getCameraPermissionsAsync()
        : kind === 'photos'
          ? await ImagePicker.getMediaLibraryPermissionsAsync()
          : await Notifications.getPermissionsAsync(),
    ),
  request: async (kind) =>
    toState(
      kind === 'camera'
        ? await ImagePicker.requestCameraPermissionsAsync()
        : kind === 'photos'
          ? await ImagePicker.requestMediaLibraryPermissionsAsync()
          : await Notifications.requestPermissionsAsync(),
    ),
};
