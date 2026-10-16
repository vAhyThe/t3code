import { PermissionChecklist, PermissionContinueButton } from "../permissions/PermissionChecklist";
import { usePermissionStatus } from "../permissions/usePermissionStatus";
import {
  isModifierPairShortcut,
  type DesktopSnapShotSetupAction,
  type DesktopSnapShotState,
} from "@t3tools/contracts";
import { useState, type ReactNode } from "react";
import { MacAccessibilityIcon, MacScreenRecordingIcon } from "../Icons";
import { CaptureShortcutConfig } from "./CaptureShortcutConfig";
import type { MessageKey } from "@t3tools/client-runtime/i18n";
import { useT } from "~/i18n/I18nProvider";
import { Button } from "../ui/button";
import { Dialog, DialogDescription } from "../ui/dialog";
import { WizardSteps, WizardPopup, WizardHeader, WizardPanel, WizardFooter } from "../ui/wizard";
import {
  captureSetupAccessReady,
  captureSetupBackend,
  captureSetupCheckMessage,
  captureSetupDesktopName,
  captureSetupInitialStep,
  captureSetupShortcutReady,
  type CaptureSetupStep,
} from "./SnapShotSetupDialog.logic";

const SETUP_STEPS = [
  { id: "access", labelKey: "settingsD.setupStepAccess" },
  { id: "shortcut", labelKey: "settingsD.setupStepShortcut" },
] as const;

const GNOME_ACCESS_COPY = {
  "not-installed": {
    titleKey: "settingsD.gnomeInstallTitle",
    descriptionKey: "settingsD.gnomeInstallDescription",
  },
  "restart-required": {
    titleKey: "settingsD.extensionInstalledTitle",
    descriptionKey: "settingsD.gnomeRestartDescription",
  },
  "update-required": {
    titleKey: "settingsD.gnomeUpdateTitle",
    descriptionKey: "settingsD.gnomeUpdateDescription",
  },
  "extensions-disabled": {
    titleKey: "settingsD.gnomeAllowTitle",
    descriptionKey: "settingsD.gnomeAllowDescription",
  },
  disabled: {
    titleKey: "settingsD.gnomeEnableTitle",
    descriptionKey: "settingsD.gnomeEnableDescription",
  },
  enabled: {
    titleKey: "settingsD.captureReadyTitle",
    descriptionKey: "settingsD.nextChooseShortcut",
  },
  unsupported: {
    titleKey: "settingsD.automaticCaptureUnavailableTitle",
    descriptionKey: "settingsD.useTakeSnapshotDescription",
  },
  error: {
    titleKey: "settingsD.gnomeErrorTitle",
    descriptionKey: "settingsD.gnomeErrorDescription",
  },
} as const;

export function SnapShotSetupDialog({
  state,
  initialStep,
  wasEnabled,
  includeAccessibility,
  busy: actionBusy,
  error,
  shortcutInput,
  shortcutStatus,
  shortcutChanged,
  canSaveShortcut,
  onSaveShortcut,
  onEnable,
  onAction,
  onRefresh,
  onClose,
  onLeaveStep,
}: {
  state: DesktopSnapShotState;
  initialStep: CaptureSetupStep;
  wasEnabled: boolean;
  includeAccessibility: boolean;
  busy: boolean;
  error: string | null;
  shortcutInput: ReactNode;
  shortcutStatus: string | null | undefined;
  shortcutChanged: boolean;
  canSaveShortcut: boolean;
  onSaveShortcut: () => Promise<boolean>;
  onEnable: () => Promise<boolean>;
  onAction: (action: DesktopSnapShotSetupAction) => Promise<void>;
  onRefresh: () => Promise<DesktopSnapShotState | undefined>;
  onClose: (completed: boolean) => Promise<void>;
  onLeaveStep: () => void;
}) {
  const t = useT();
  const [step, setStep] = useState(() => captureSetupInitialStep(state, initialStep));
  const [checking, setChecking] = useState(false);
  const [checked, setChecked] = useState(false);
  const [configBusy, setConfigBusy] = useState(false);
  const busy = actionBusy || checking || configBusy;
  const backend = captureSetupBackend(state);
  const configShortcut = backend === "niri" || backend === "hyprland";
  const desktop = captureSetupDesktopName(state);
  const extension = state.gnomeExtension;
  const helper = backend === "hyprland" ? state.hyprlandHelper : state.kdeHelper;
  const helperBackend = backend === "kde" || backend === "hyprland";
  const installHelper = backend === "hyprland" ? "install-hyprland-helper" : "install-kde-helper";
  const removeHelper = backend === "hyprland" ? "remove-hyprland-helper" : "remove-kde-helper";
  const accessReady = captureSetupAccessReady(state);
  const permissionStatus = usePermissionStatus(
    async () => {
      const refreshed = await onRefresh();
      if (!refreshed?.macPermissions) throw new Error("Permission status unavailable");
      return refreshed.macPermissions;
    },
    state.macPermissions ?? { screenRecording: false, accessibility: false },
    Boolean(state.macPermissions) && step === "access" && !busy,
  );
  const macPermissions = state.macPermissions ? permissionStatus.status : undefined;
  const macPermissionsReady =
    !macPermissions ||
    permissionStatus.isReady(
      includeAccessibility ? ["screenRecording", "accessibility"] : ["screenRecording"],
    );
  const shortcutReady = captureSetupShortcutReady(state, shortcutChanged);
  const install = extension?.status === "not-installed" || extension?.status === "update-required";
  const enable = extension?.status === "disabled";
  const changeStep = (next: CaptureSetupStep) => {
    onLeaveStep();
    setChecked(false);
    setStep(next);
  };
  const checkAgain = async () => {
    if (busy) return;
    setChecking(true);
    setChecked(false);
    try {
      setChecked((await onRefresh()) !== undefined);
    } finally {
      setChecking(false);
    }
  };
  const accessCopy: { readonly titleKey: MessageKey; readonly descriptionKey: MessageKey } =
    state.message && !macPermissions
      ? {
          titleKey: "settingsD.tryAgainTitle",
          descriptionKey: "settingsD.snapShotCheckFailedDescription",
        }
      : backend === "gnome" && extension
        ? extension.status === "enabled" && !accessReady
          ? {
              titleKey: "settingsD.checkCaptureAccessTitle",
              descriptionKey: "settingsD.extensionNotReadyDescription",
            }
          : GNOME_ACCESS_COPY[extension.status]
        : helperBackend
          ? helper?.status === "ready"
            ? {
                titleKey: "settingsD.captureReadyTitle",
                descriptionKey: "settingsD.nextChooseShortcut",
              }
            : helper?.status === "error"
              ? {
                  titleKey: "settingsD.fixCaptureAccessTitle",
                  descriptionKey: "settingsD.reinstallHelperDescription",
                }
              : {
                  titleKey:
                    helper?.status === "update-required"
                      ? "settingsD.updateCaptureHelperTitle"
                      : "settingsD.allowSnapShotsTitle",
                  descriptionKey: "settingsD.captureHelperDescription",
                }
          : backend === "niri"
            ? {
                titleKey: "settingsD.captureReadyTitle",
                descriptionKey: "settingsD.nextChooseShortcut",
              }
            : backend === "picker"
              ? {
                  titleKey: "settingsD.chooseWindowEachTimeTitle",
                  descriptionKey: "settingsD.pickerDescription",
                }
              : {
                  titleKey: "settingsD.allowSnapShotsTitle",
                  descriptionKey:
                    backend === "portal"
                      ? "settingsD.portalPermissionDescription"
                      : macPermissions
                        ? macPermissionsReady
                          ? "settingsD.macTestDescription"
                          : "settingsD.allowEachPermissionDescription"
                        : "settingsD.allowAccessWhenPromptedDescription",
                };
  const title = step === "access" ? t(accessCopy.titleKey) : t("settingsD.chooseYourShortcutTitle");
  const description =
    step === "access"
      ? t(accessCopy.descriptionKey)
      : configShortcut
        ? t("settingsD.clickShortcutDescription")
        : state.mode === "portal"
          ? t("settingsD.portalShortcutDescription")
          : t("settingsD.bothShiftDescription");
  const stepIndex = SETUP_STEPS.findIndex(({ id }) => id === step);
  const details = [
    ...new Set(
      [
        error,
        ...(step === "access"
          ? [
              state.message,
              backend === "gnome" &&
              (extension?.status === "error" || extension?.status === "unsupported")
                ? extension.message
                : null,
              helperBackend && helper?.status === "error" ? helper.message : null,
            ]
          : []),
      ].filter((detail) => detail !== null),
    ),
  ];

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !busy) void onClose(false);
      }}
    >
      <WizardPopup showCloseButton={!busy}>
        <WizardHeader
          title={
            desktop ? t("settingsD.setUpSnapShotsFor", { desktop }) : t("settingsD.setUpSnapShots")
          }
        >
          <WizardSteps
            steps={SETUP_STEPS.map((item) => t(item.labelKey))}
            currentStep={stepIndex}
            isStepDisabled={(index) => busy || index > stepIndex}
            onStepChange={(index) => {
              const next = SETUP_STEPS[index];
              if (next && next.id !== step) changeStep(next.id);
            }}
          />
        </WizardHeader>
        <WizardPanel>
          <div className="space-y-4 text-sm">
            <div className="space-y-2" aria-live="polite">
              <h3 className="flex items-center gap-2 font-medium">{title}</h3>
              <DialogDescription>{description}</DialogDescription>
            </div>
            {step === "access" ? (
              <>
                <p
                  role="status"
                  aria-atomic="true"
                  className={
                    checked && !busy && !error ? "text-xs text-muted-foreground" : "sr-only"
                  }
                >
                  {checked && !busy && !error ? captureSetupCheckMessage(state) : null}
                </p>
                {macPermissions ? (
                  <PermissionChecklist
                    busy={busy}
                    permissions={[
                      {
                        id: "screenRecording",
                        icon: <MacScreenRecordingIcon className="size-8 shrink-0 drop-shadow-sm" />,
                        title: t("settingsD.screenRecording"),
                        description: t("settingsD.captureCurrentWindow"),
                        granted: macPermissions.screenRecording,
                        onAllow: () => void onAction("allow-screen-recording"),
                      },
                      {
                        id: "accessibility",
                        icon: <MacAccessibilityIcon className="size-8 shrink-0 drop-shadow-sm" />,
                        title: t("settingsD.accessibility"),
                        description: includeAccessibility
                          ? t("settingsD.includeTextFromApp")
                          : t("settingsD.optionalIncludeTextFromApp"),
                        granted: macPermissions.accessibility,
                        onAllow: () => void onAction("allow-accessibility"),
                      },
                    ]}
                  />
                ) : null}
                {permissionStatus.error && macPermissions ? (
                  <p role="status" className="text-xs text-muted-foreground">
                    {permissionStatus.error}
                  </p>
                ) : null}
                {helperBackend && helper?.status === "error" ? (
                  <Button
                    size="xs"
                    variant="outline"
                    disabled={busy}
                    onClick={() => void onAction(installHelper)}
                  >
                    {t("settingsD.reinstallHelper")}
                  </Button>
                ) : null}
              </>
            ) : configShortcut ? (
              <CaptureShortcutConfig
                state={state}
                disabled={actionBusy || checking || !accessReady}
                onBusyChange={setConfigBusy}
                onSaved={onRefresh}
                onComplete={() => onClose(true)}
              />
            ) : (
              <div className="space-y-3">
                {shortcutInput}
                {shortcutStatus ? (
                  <p className="text-xs text-muted-foreground" role="status">
                    {shortcutStatus}
                  </p>
                ) : null}
                {!shortcutChanged &&
                !state.shortcutRegistered &&
                !state.shortcutPending &&
                state.shortcutCanRetry !== false &&
                !isModifierPairShortcut(state.shortcut) ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={busy}
                    onClick={() => void onAction("retry-shortcut")}
                  >
                    {state.mode === "portal"
                      ? t("settingsD.shortcutPermissions")
                      : t("common.tryAgain")}
                  </Button>
                ) : null}
              </div>
            )}
            {step === "shortcut" && !accessReady ? (
              <p role="alert" className="text-destructive">
                {t("settingsD.captureNeedsAttention")}
              </p>
            ) : null}
            {error ? (
              <p role="alert" className="text-destructive">
                {t("settingsD.couldntFinishStep")}
              </p>
            ) : null}
            {details.length > 0 || (step === "access" && (backend === "gnome" || helperBackend)) ? (
              <details className="text-xs text-muted-foreground">
                <summary className="cursor-pointer">{t("settingsD.advanced")}</summary>
                <div className="mt-3 space-y-3">
                  {details.map((detail) => (
                    <p key={detail} className="break-words">
                      {detail}
                    </p>
                  ))}
                  {step === "access" && (backend === "gnome" || helperBackend) ? (
                    <p>{t("settingsD.includedNoDownload")}</p>
                  ) : null}
                  {step === "access" && backend === "gnome" && extension?.status === "enabled" ? (
                    <Button
                      size="xs"
                      variant="ghost"
                      disabled={busy}
                      onClick={() => void onAction("disable-extension")}
                    >
                      {t("settingsD.disableExtension")}
                    </Button>
                  ) : null}
                  {step === "access" && helperBackend && helper?.status !== "not-installed" ? (
                    <Button
                      size="xs"
                      variant="ghost"
                      disabled={busy}
                      onClick={() => void onAction(removeHelper)}
                    >
                      {t("settingsD.removeCaptureHelper")}
                    </Button>
                  ) : null}
                </div>
              </details>
            ) : null}
          </div>
        </WizardPanel>
        <WizardFooter>
          {step !== "access" ? (
            <Button variant="ghost" disabled={busy} onClick={() => changeStep("access")}>
              {t("settingsD.back")}
            </Button>
          ) : null}
          <Button variant="ghost" disabled={busy} onClick={() => void onClose(false)}>
            {wasEnabled ? t("common.close") : t("settingsD.finishLater")}
          </Button>
          {step === "access" ? (
            helperBackend && !accessReady && helper?.status !== "ready" ? (
              <Button
                disabled={busy}
                aria-busy={busy}
                onClick={() =>
                  void (helper?.status === "error" ? checkAgain() : onAction(installHelper))
                }
              >
                {checking
                  ? t("settingsD.checking")
                  : busy
                    ? t("settingsD.installing")
                    : helper?.status === "error"
                      ? t("settingsD.checkAgain")
                      : helper?.status === "update-required"
                        ? t("settingsD.updateHelper")
                        : t("settingsD.installHelper")}
              </Button>
            ) : backend === "gnome" && !accessReady && extension?.status !== "enabled" ? (
              <Button
                disabled={busy}
                aria-busy={checking}
                onClick={() =>
                  void (install
                    ? onAction("install-extension")
                    : enable
                      ? onAction("enable-extension")
                      : checkAgain())
                }
              >
                {checking
                  ? t("settingsD.checking")
                  : busy
                    ? install
                      ? t("settingsD.installing")
                      : enable
                        ? t("settingsD.enabling")
                        : t("settingsD.working")
                    : install
                      ? extension?.status === "update-required"
                        ? t("settingsD.updateExtension")
                        : t("settingsD.installExtension")
                      : enable
                        ? t("settingsD.enableExtension")
                        : t("settingsD.checkAgain")}
              </Button>
            ) : (
              <PermissionContinueButton
                ready={macPermissionsReady}
                busy={busy}
                onClick={async () => {
                  if (await onEnable()) changeStep("shortcut");
                }}
              >
                {busy
                  ? t("settingsD.working")
                  : macPermissions
                    ? t("settingsD.testCaptureAndContinue")
                    : backend === "direct"
                      ? t("settingsD.allowCapture")
                      : !accessReady && !macPermissions
                        ? t("common.tryAgain")
                        : t("common.continue")}
              </PermissionContinueButton>
            )
          ) : !configShortcut ? (
            <Button
              disabled={
                busy || !accessReady || (shortcutChanged ? !canSaveShortcut : !shortcutReady)
              }
              onClick={async () => {
                if (!shortcutChanged || (await onSaveShortcut())) await onClose(true);
              }}
            >
              {busy
                ? t("settingsD.saving")
                : shortcutChanged
                  ? t("settingsD.saveAndFinish")
                  : t("common.done")}
            </Button>
          ) : null}
        </WizardFooter>
      </WizardPopup>
    </Dialog>
  );
}
