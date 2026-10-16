import type { ClientSettingsPatch, DesktopSnapShotState, SnapShotSound } from "@t3tools/contracts";
import {
  captureSetupBackend,
  captureSetupDesktopName,
  captureSetupAccessReady,
  captureSetupMacPermissionsReady,
} from "./SnapShotSetupDialog.logic";
import { currentTranslator } from "~/i18n/I18nProvider";

export function snapShotStatus(state: DesktopSnapShotState | null, enabled: boolean): string {
  if (!state) return currentTranslator()("shellRest.snapShotChecking");
  if (state.mode === "unavailable")
    return state.message ?? currentTranslator()("shellRest.snapShotNotSupported");
  if (!enabled) return currentTranslator()("shellRest.snapShotTurnOnToSetUp");
  return snapShotSetupSummary(state, enabled);
}

export function snapShotSetupSummary(state: DesktopSnapShotState, enabled: boolean): string {
  if (state.message) return currentTranslator()("shellRest.captureNeedsAttention");
  if (state.linuxBackend === "hyprland" && state.hyprlandHelper?.status !== "ready")
    return state.hyprlandHelper?.status === "error"
      ? currentTranslator()("shellRest.checkCaptureAccessInSetup")
      : currentTranslator()("shellRest.installCaptureHelperToContinue");
  if (captureSetupBackend(state) === "gnome" && state.gnomeExtension?.status !== "enabled")
    return currentTranslator()("shellRest.setUpActiveWindowSnapshots");
  if (captureSetupBackend(state) === "kde" && state.kdeHelper?.status !== "ready")
    return state.kdeHelper?.status === "error"
      ? currentTranslator()("shellRest.checkCaptureAccessInSetup")
      : currentTranslator()("shellRest.installCaptureHelperToContinue");
  if (captureSetupBackend(state) === "picker")
    return currentTranslator()("shellRest.manualCaptureOnly");
  if (!enabled) return currentTranslator()("shellRest.enableCaptureToContinue");
  if (state.shortcutPending)
    return state.linuxBackend === "hyprland"
      ? currentTranslator()("shellRest.connectingShortcut")
      : currentTranslator()("shellRest.waitingForShortcutPermission");
  if (state.shortcutVerified) return currentTranslator()("shellRest.readyToCapture");
  if (state.linuxBackend === "niri" && state.shortcutBinding)
    return currentTranslator()("shellRest.useShortcutFromOtherApp");
  if (state.linuxBackend === "hyprland" && state.shortcutActionRegistered)
    return currentTranslator()("shellRest.useShortcutFromOtherApp");
  if (state.shortcutRegistered)
    return state.shortcutLabel
      ? currentTranslator()("shellRest.readyToCapture")
      : currentTranslator()("shellRest.shortcutSaved");
  return currentTranslator()("shellRest.finishShortcutSetup");
}

export function snapShotShortcutStatus(state: DesktopSnapShotState | null): string | null {
  if (!state) return null;
  if (state.linuxBackend === "hyprland") return state.shortcutMessage;
  if (state.shortcutPending)
    return currentTranslator()("shellRest.approveShortcutPermissionPrompt");
  if (state.shortcutRegistered)
    return state.mode === "portal" ? null : currentTranslator()("shellRest.shortcutSavedPeriod");
  return state.shortcutMessage;
}

export function snapShotSetupButtonLabel(state: DesktopSnapShotState | null): string {
  if (!state) return currentTranslator()("shellRest.continueSetup");
  if (captureSetupAccessReady(state)) return currentTranslator()("shellRest.manageCapture");
  const desktop = captureSetupDesktopName(state);
  return desktop
    ? currentTranslator()("shellRest.setUpDesktopCapture", { desktop })
    : currentTranslator()("shellRest.continueSetup");
}

// Windows needs no permissions or setup: turning capture on is enough. macOS setup
// has nothing left to manage once permissions and the shortcut are in place; the
// shortcut row stays editable inline. Revoking a permission brings the button back
// as currentTranslator()("shellRest.continueSetup") through the state message.
export function snapShotSetupComplete(
  state: DesktopSnapShotState | null,
  includeAccessibility: boolean,
): boolean {
  if (state?.windows) return true;
  return (
    state?.macPermissions !== undefined &&
    captureSetupAccessReady(state) &&
    captureSetupMacPermissionsReady(state, includeAccessibility) &&
    state.shortcutRegistered
  );
}

export type SnapShotSoundSelection = SnapShotSound | "off";

export function snapShotFeedbackUnavailableMessage(
  state: DesktopSnapShotState | null,
): string | undefined {
  if (state?.mode !== "portal" || state.linuxFeedbackAvailable) return undefined;
  if (state.linuxBackend === "hyprland")
    return state.hyprlandHelper?.status === "ready"
      ? currentTranslator()("shellRest.captureEffectsUnavailableDesktop")
      : currentTranslator()("shellRest.installOrUpdateCaptureHelperEffects");
  if (state.linuxBackend === "niri")
    return currentTranslator()("shellRest.captureEffectsUnavailableNiri");
  if (state.linuxBackend === "kde")
    return state.kdeHelper?.status === "ready"
      ? currentTranslator()("shellRest.captureEffectsUnavailableDesktop")
      : currentTranslator()("shellRest.installOrUpdateCaptureHelperEffects");
  return state.linuxBackend === "gnome-extension"
    ? currentTranslator()("shellRest.updateGnomeExtensionEffects")
    : captureSetupBackend(state) === "gnome"
      ? currentTranslator()("shellRest.finishExtensionSetupEffects")
      : currentTranslator()("shellRest.captureEffectsUnavailableDesktop");
}

export function snapShotDescription(state: DesktopSnapShotState | null): string {
  return state?.mode === "portal" && captureSetupBackend(state) === "picker"
    ? currentTranslator()("shellRest.automaticCaptureUnavailable")
    : currentTranslator()("shellRest.captureWindowAttachDraft");
}

export function snapShotAccessibilityUnavailableMessage(
  state: DesktopSnapShotState | null,
): string | undefined {
  if (state?.mode !== "portal") return undefined;
  if (state.linuxBackend === "picker" || state.linuxBackend === "screenshot-portal")
    return currentTranslator()("shellRest.onlyScreenshotDesktop");
  return undefined;
}

export function snapShotUnavailableMessage(hasBridge: boolean): string | undefined {
  if (hasBridge) return undefined;
  return typeof window !== "undefined" && window.desktopBridge
    ? currentTranslator()("shellRest.updateDesktopToUseSnapshots")
    : currentTranslator()("shellRest.onlyDesktopApp");
}

export function snapShotSoundPatch(sound: SnapShotSoundSelection): ClientSettingsPatch {
  return sound === "off"
    ? { snapShotPlaySound: false }
    : { snapShotPlaySound: true, snapShotSound: sound };
}

export function createRecordingRequestTracker() {
  let currentRequest: symbol | null = null;

  return {
    tryBegin() {
      if (currentRequest) return null;
      currentRequest = Symbol();
      return currentRequest;
    },
    clear() {
      currentRequest = null;
    },
    owns(request: symbol) {
      return currentRequest === request;
    },
  };
}
