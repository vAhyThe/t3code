import { currentTranslator, useT } from "~/i18n/I18nProvider";
import { SettingsGroup } from "./SettingsGroup";

import { CurrencySetting } from "./CurrencySetting";
import { LanguageSetting } from "./LanguageSetting";
import { NotificationSettings } from "./NotificationSettings";
import { PRIVACY_POLICY_URL } from "../../legalLinks";
import { CheckIcon, ChevronRightIcon } from "lucide-react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useRef, useState } from "react";
import {
  type DesktopUpdateChannel,
  IDLE_COMPACTION_MODES,
  globalIdleCompaction,
  ProviderDriverKind,
  type ProviderInstanceId,
  type SidebarProjectGroupingMode,
} from "@t3tools/contracts";
import {
  DEFAULT_UNIFIED_SETTINGS,
  type DiffLayout,
  MAX_SIDEBAR_AUTO_SETTLE_AFTER_DAYS,
  MIN_SIDEBAR_AUTO_SETTLE_AFTER_DAYS,
  type ResponseStreamingMode,
  type QuitConfirmationMode,
  SidebarProjectSortOrder,
} from "@t3tools/contracts/settings";
import { createModelSelection } from "@t3tools/shared/model";
import * as Equal from "effect/Equal";
import * as Schema from "effect/Schema";
import { APP_VERSION, HOSTED_APP_CHANNEL, HOSTED_APP_CHANNEL_LABEL } from "../../branding";
import { CliCommandSettingsRow } from "./CliCommandSettingsRow";
import { MobileAppSettingsRow } from "./MobileAppSettingsRow";
import {
  canCheckForUpdate,
  getDesktopUpdateButtonTooltip,
  getDesktopUpdateDisabledReason,
  getDesktopUpdateInstallConfirmationMessage,
  isDesktopUpdateButtonDisabled,
  resolveDesktopUpdateButtonAction,
} from "../../components/desktopUpdate.logic";
import { ProviderModelPicker } from "../chat/ProviderModelPicker";
import { TraitsPicker } from "../chat/TraitsPicker";
import { isElectron } from "../../env";
import { buildHostedChannelSelectionUrl, type HostedAppChannel } from "../../hostedPairing";
import {
  readAppearanceModePreference,
  readThemeHalves,
  readThemePreference,
  useTheme,
} from "../../hooks/useTheme";
import {
  useScopedSettings,
  useScopedSettingsMixed,
  useUpdateScopedSettings,
} from "./useScopedSettings";
import { useScopedModelDisabledReason } from "./useScopedModelAvailability";
import { useSettingsScope } from "./SettingsScopeContext";
import { scopedIdleCompaction } from "./scopedSettings";
import { ProjectDefaultsSettings } from "./ProjectDefaultsSettings";
import { ThreadTitleInstructionsSettings } from "./ThreadTitleInstructionsSettings";
import { useDesktopUpdateState } from "../../state/desktopUpdate";
import {
  getCustomModelOptionsByInstance,
  resolveAppModelSelectionState,
  selectsPlanAgent,
} from "../../modelSelection";
import {
  applyProviderInstanceSettings,
  deriveProviderInstanceEntries,
  sortProviderInstanceEntries,
} from "../../providerInstances";
import { ensureLocalApi, readLocalApi } from "../../localApi";
import { isMacPlatform } from "../../lib/utils";
import { useEnvironmentProviders } from "../../state/environments";
import { EMPTY_SERVER_PROVIDERS } from "../../state/server";
import { Button } from "../ui/button";
import { Collapsible, CollapsiblePanel, CollapsibleTrigger } from "../ui/collapsible";
import { DraftInput } from "../ui/draft-input";
import { Input } from "../ui/input";
import { Select, SelectItem, SelectPopup, SelectTrigger, SelectValue } from "../ui/select";
import { Switch } from "../ui/switch";
import { ScopedSwitch } from "./ScopedSwitch";
import { stackedThreadToast, toastManager } from "../ui/toast";
import { Tooltip, TooltipPopup, TooltipTrigger } from "../ui/tooltip";
import {
  getChangedBrowserSettingLabels,
  getChangedTypographySettingLabels,
  hasChangedBackgroundActivitySettings,
  isProjectGroupingEnabled,
  projectGroupingModeFromToggle,
  readLastEnabledProjectGroupingMode,
  rememberEnabledProjectGroupingMode,
} from "./SettingsPanels.logic";
import {
  SETTINGS_PICKER_TRIGGER_CLASSNAME,
  SettingResetButton,
  SettingsPageContainer,
  SettingsRow,
  SettingsSection,
  useSettingsSearchTarget,
  useSettingsSearchTargetId,
} from "./settingsLayout";
import { searchableSetting } from "./settingsSearch";
import { BackgroundActivitySettingsRow } from "./BackgroundActivitySettings";

const RESPONSE_STREAMING_MODE_LABELS: Record<ResponseStreamingMode, string> = {
  get turn() {
    return currentTranslator()("settingsC.streamingWaitFull");
  },
  get paragraph() {
    return currentTranslator()("settingsC.streamingParagraphs");
  },
};

const RESPONSE_STREAMING_MODE_DESCRIPTIONS: Record<ResponseStreamingMode, string> = {
  get turn() {
    return currentTranslator()("settingsC.streamingTurnDesc");
  },
  get paragraph() {
    return currentTranslator()("settingsC.streamingParagraphDesc");
  },
};

const SIDEBAR_PROJECT_SORT_ORDER_LABELS: Record<SidebarProjectSortOrder, string> = {
  get updated_at() {
    return currentTranslator()("settingsC.sortLastMessage");
  },
  get created_at() {
    return currentTranslator()("settingsC.sortCreatedAt");
  },
  get manual() {
    return currentTranslator()("settingsC.sortManual");
  },
};
const isSidebarProjectSortOrder = Schema.is(SidebarProjectSortOrder);

const TIMESTAMP_FORMAT_LABELS = {
  get locale() {
    return currentTranslator()("settingsC.timestampSystemDefault");
  },
  get "12-hour"() {
    return currentTranslator()("settingsC.timestamp12h");
  },
  get "24-hour"() {
    return currentTranslator()("settingsC.timestamp24h");
  },
};

const DIFF_LAYOUT_LABELS: Record<DiffLayout, string> = {
  get stacked() {
    return currentTranslator()("settingsC.diffStacked");
  },
  get split() {
    return currentTranslator()("settingsC.diffSplit");
  },
};

const QUIT_CONFIRMATION_MODE_LABELS: Record<QuitConfirmationMode, string> = {
  get direct() {
    return currentTranslator()("settingsC.quitDirect");
  },
  get hold() {
    return currentTranslator()("settingsC.quitHold");
  },
  get "double-click"() {
    return currentTranslator()("settingsC.quitDoublePress");
  },
};

const DEFAULT_DRIVER_KIND = ProviderDriverKind.make("codex");
function AboutVersionTitle() {
  const t = useT();
  return (
    <span className="inline-flex items-baseline gap-2">
      <span>{t("settingsC.version")}</span>
      <code className="text-2xs font-medium text-muted-foreground">{APP_VERSION}</code>
    </span>
  );
}

function AboutVersionSection() {
  const t = useT();
  const updateState = useDesktopUpdateState();
  const [isChangingUpdateChannel, setIsChangingUpdateChannel] = useState(false);
  const [isUpdateActionPending, setIsUpdateActionPending] = useState(false);

  const hasDesktopBridge = typeof window !== "undefined" && Boolean(window.desktopBridge);
  const selectedUpdateChannel = updateState?.channel ?? "latest";
  const selectedHostedAppChannel = hasDesktopBridge ? null : HOSTED_APP_CHANNEL;

  const handleUpdateChannelChange = (channel: DesktopUpdateChannel) => {
    const bridge = window.desktopBridge;
    if (
      !bridge ||
      typeof bridge.setUpdateChannel !== "function" ||
      channel === selectedUpdateChannel
    ) {
      return;
    }

    setIsChangingUpdateChannel(true);
    void bridge
      .setUpdateChannel(channel)
      .catch((error: unknown) => {
        toastManager.add(
          stackedThreadToast({
            type: "error",
            title: t("settingsC.couldNotChangeTrack"),
            description: error instanceof Error ? error.message : t("settingsC.trackChangeFailed"),
          }),
        );
      })
      .finally(() => {
        setIsChangingUpdateChannel(false);
      });
  };

  const handleButtonClick = async () => {
    const bridge = window.desktopBridge;
    if (!bridge) return;

    const action = updateState ? resolveDesktopUpdateButtonAction(updateState) : "none";

    if (action === "download") {
      void bridge.downloadUpdate().catch((error: unknown) => {
        toastManager.add(
          stackedThreadToast({
            type: "error",
            title: t("settingsC.couldNotDownloadUpdate"),
            description: error instanceof Error ? error.message : t("settingsC.downloadFailed"),
          }),
        );
      });
      return;
    }

    if (action === "install") {
      if (isUpdateActionPending) return;
      setIsUpdateActionPending(true);
      let confirmed = false;
      try {
        confirmed = await ensureLocalApi().dialogs.confirm(
          getDesktopUpdateInstallConfirmationMessage(
            updateState ?? { availableVersion: null, downloadedVersion: null },
          ),
        );
      } catch (error) {
        setIsUpdateActionPending(false);
        toastManager.add(
          stackedThreadToast({
            type: "error",
            title: t("settingsC.couldNotConfirmUpdate"),
            description: error instanceof Error ? error.message : t("settingsC.confirmationFailed"),
          }),
        );
        return;
      }
      if (!confirmed) {
        setIsUpdateActionPending(false);
        return;
      }
      void bridge
        .installUpdate()
        .catch((error: unknown) => {
          toastManager.add(
            stackedThreadToast({
              type: "error",
              title: t("settingsC.couldNotInstallUpdate"),
              description: error instanceof Error ? error.message : t("settingsC.installFailed"),
            }),
          );
        })
        .finally(() => setIsUpdateActionPending(false));
      return;
    }

    if (typeof bridge.checkForUpdate !== "function") return;
    void bridge
      .checkForUpdate()
      .then((result) => {
        if (!result.checked) {
          toastManager.add(
            stackedThreadToast({
              type: "error",
              title: t("settingsC.couldNotCheckUpdates"),
              description: result.state.message ?? t("settingsC.autoUpdatesUnavailable"),
            }),
          );
        }
      })
      .catch((error: unknown) => {
        toastManager.add(
          stackedThreadToast({
            type: "error",
            title: t("settingsC.couldNotCheckUpdates"),
            description: error instanceof Error ? error.message : t("settingsC.updateCheckFailed"),
          }),
        );
      });
  };

  const action = updateState ? resolveDesktopUpdateButtonAction(updateState) : "none";
  const buttonTooltip = updateState ? getDesktopUpdateButtonTooltip(updateState) : null;
  const buttonDisabled =
    action === "none"
      ? !canCheckForUpdate(updateState)
      : isDesktopUpdateButtonDisabled(updateState);

  const actionLabel: Record<string, string> = {
    download: currentTranslator()("settingsC.download"),
    install: currentTranslator()("settingsC.install"),
  };
  const statusLabel: Record<string, string> = {
    checking: "Checking…",
    downloading: "Downloading…",
    "up-to-date": currentTranslator()("settingsC.upToDate"),
  };
  const buttonLabel =
    actionLabel[action] ??
    statusLabel[updateState?.status ?? ""] ??
    currentTranslator()("settingsC.checkForUpdates");
  const description =
    action === "download" || action === "install"
      ? currentTranslator()("settingsC.updateAvailable")
      : (getDesktopUpdateDisabledReason(updateState) ?? "Current version of the application.");

  return (
    <>
      <SettingsRow
        id={searchableSetting("app-version").id}
        title={<AboutVersionTitle />}
        description={description}
        control={
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  size="sm"
                  variant="outline"
                  disabled={buttonDisabled || isUpdateActionPending}
                  onClick={handleButtonClick}
                >
                  {buttonLabel}
                </Button>
              }
            />
            {buttonTooltip ? <TooltipPopup>{buttonTooltip}</TooltipPopup> : null}
          </Tooltip>
        }
      />
      {hasDesktopBridge ? (
        <SettingsRow
          {...searchableSetting("update-track")}
          description={t("settingsC.useStableOrNightly")}
          control={
            <Select
              value={selectedUpdateChannel}
              onValueChange={(value) => {
                handleUpdateChannelChange(value as DesktopUpdateChannel);
              }}
            >
              <SelectTrigger
                size="sm"
                className="w-full sm:w-40"
                aria-label={t("settingsC.updateTrack")}
                disabled={isChangingUpdateChannel}
              >
                <SelectValue>
                  {selectedUpdateChannel === "nightly"
                    ? t("settingsC.nightly")
                    : t("settingsC.stable")}
                </SelectValue>
              </SelectTrigger>
              <SelectPopup align="end" alignItemWithTrigger={false}>
                <SelectItem hideIndicator value="latest">
                  {t("settingsC.stable")}
                </SelectItem>
                <SelectItem hideIndicator value="nightly">
                  {t("settingsC.nightly")}
                </SelectItem>
              </SelectPopup>
            </Select>
          }
        />
      ) : selectedHostedAppChannel ? (
        <SettingsRow
          {...searchableSetting("update-track")}
          description={t("settingsC.switchesReleaseChannel")}
          control={
            <Select
              value={selectedHostedAppChannel}
              onValueChange={(value) => {
                if (value === selectedHostedAppChannel) return;
                window.location.assign(
                  buildHostedChannelSelectionUrl({ channel: value as HostedAppChannel }),
                );
              }}
            >
              <SelectTrigger
                size="sm"
                className="w-full sm:w-40"
                aria-label={t("settingsC.updateTrack")}
              >
                <SelectValue>{HOSTED_APP_CHANNEL_LABEL}</SelectValue>
              </SelectTrigger>
              <SelectPopup align="end" alignItemWithTrigger={false}>
                <SelectItem hideIndicator value="latest">
                  {t("settingsC.latest")}
                </SelectItem>
                <SelectItem hideIndicator value="nightly">
                  {t("settingsC.nightly")}
                </SelectItem>
              </SelectPopup>
            </Select>
          }
        />
      ) : null}
      {hasDesktopBridge ? <CliCommandSettingsRow /> : null}
    </>
  );
}

export function useSettingsRestore(onRestored?: () => void) {
  const t = currentTranslator();
  const {
    theme,
    setTheme,
    followSystem,
    setFollowSystem,
    setThemeHalf,
    clearThemeHalves,
    themeHalves,
  } = useTheme();
  const settings = useScopedSettings();
  const updateSettings = useUpdateScopedSettings();

  const isTextGenerationModelDirty = !Equal.equals(
    settings.textGenerationModelSelection ?? null,
    DEFAULT_UNIFIED_SETTINGS.textGenerationModelSelection ?? null,
  );
  const isBackgroundActivityDirty = hasChangedBackgroundActivitySettings(settings);

  const changedSettingLabels = [
    ...(theme !== "system" ? [currentTranslator()("settingsC.restoreTheme")] : []),
    ...(!followSystem ? [currentTranslator()("settingsC.restoreFollowSystem")] : []),
    ...(themeHalves !== null ? [currentTranslator()("settingsC.restoreThemeMix")] : []),
    ...(settings.appearanceContrast !== DEFAULT_UNIFIED_SETTINGS.appearanceContrast
      ? [currentTranslator()("settingsC.restoreContrast")]
      : []),
    ...(settings.glassOpacity !== DEFAULT_UNIFIED_SETTINGS.glassOpacity
      ? [currentTranslator()("settingsC.restoreGlassOpacity")]
      : []),
    ...(settings.diffColorScheme !== DEFAULT_UNIFIED_SETTINGS.diffColorScheme
      ? [currentTranslator()("settingsC.restoreDiffColors")]
      : []),
    ...(settings.chatWidth !== DEFAULT_UNIFIED_SETTINGS.chatWidth
      ? [currentTranslator()("settingsC.restoreChatWidth")]
      : []),
    ...(settings.chatWidth !== DEFAULT_UNIFIED_SETTINGS.chatWidth ? ["Chat width"] : []),
    ...(settings.mathRenderingEnabled !== DEFAULT_UNIFIED_SETTINGS.mathRenderingEnabled
      ? [currentTranslator()("settingsC.renderMath")]
      : []),
    ...(settings.redesignEnabled !== DEFAULT_UNIFIED_SETTINGS.redesignEnabled
      ? ["New design"]
      : []),
    ...(settings.panelAnimationDurationMs !== DEFAULT_UNIFIED_SETTINGS.panelAnimationDurationMs
      ? [currentTranslator()("settingsC.restorePanelAnimations")]
      : []),
    ...(settings.environmentIdentificationMode !==
    DEFAULT_UNIFIED_SETTINGS.environmentIdentificationMode
      ? [currentTranslator()("settingsC.restoreEnvIdentification")]
      : []),
    ...(settings.interfaceLanguage !== DEFAULT_UNIFIED_SETTINGS.interfaceLanguage
      ? [currentTranslator()("settingsC.restoreLanguage")]
      : []),
    ...(settings.displayCurrency !== DEFAULT_UNIFIED_SETTINGS.displayCurrency
      ? [currentTranslator()("settingsC.restoreDisplayCurrency")]
      : []),
    ...(settings.timestampFormat !== DEFAULT_UNIFIED_SETTINGS.timestampFormat
      ? [currentTranslator()("settingsC.restoreTimeFormat")]
      : []),
    ...(settings.notificationMode !== DEFAULT_UNIFIED_SETTINGS.notificationMode
      ? [currentTranslator()("settingsC.restoreThreadNotifications")]
      : []),
    ...(settings.inAppNotificationsEnabled !== DEFAULT_UNIFIED_SETTINGS.inAppNotificationsEnabled
      ? [currentTranslator()("settingsC.restoreInAppNotifications")]
      : []),
    ...(settings.sidebarThreadPreviewCount !== DEFAULT_UNIFIED_SETTINGS.sidebarThreadPreviewCount
      ? [currentTranslator()("settingsC.restoreVisibleThreads")]
      : []),
    ...(settings.sidebarProjectGroupingMode !== DEFAULT_UNIFIED_SETTINGS.sidebarProjectGroupingMode
      ? [currentTranslator()("settingsC.restoreProjectGrouping")]
      : []),
    ...(settings.sidebarProjectSortOrder !== DEFAULT_UNIFIED_SETTINGS.sidebarProjectSortOrder
      ? [currentTranslator()("settingsC.restoreProjectOrder")]
      : []),
    ...(settings.sidebarWorkingShelfEnabled !== DEFAULT_UNIFIED_SETTINGS.sidebarWorkingShelfEnabled
      ? [currentTranslator()("settingsC.restoreWorkingSection")]
      : []),
    ...(settings.sidebarAutoSettleAfterDays !== DEFAULT_UNIFIED_SETTINGS.sidebarAutoSettleAfterDays
      ? [currentTranslator()("settingsC.restoreAutoSettleInactive")]
      : []),
    ...(settings.sidebarAutoSettleKeepPullRequests !==
    DEFAULT_UNIFIED_SETTINGS.sidebarAutoSettleKeepPullRequests
      ? [currentTranslator()("settingsC.restoreKeepPrThreads")]
      : []),
    ...(settings.sidebarAutoSettleOnMerge !== DEFAULT_UNIFIED_SETTINGS.sidebarAutoSettleOnMerge
      ? [currentTranslator()("settingsC.restoreAutoSettleMerged")]
      : []),
    ...(settings.autoResumeLimitedThreads !== DEFAULT_UNIFIED_SETTINGS.autoResumeLimitedThreads
      ? ["Resume after usage limits"]
      : []),
    ...(settings.snoozeLimitedThreads !== DEFAULT_UNIFIED_SETTINGS.snoozeLimitedThreads
      ? ["Snooze until limits reset"]
      : []),
    ...(settings.persistComposerContextStrip !==
    DEFAULT_UNIFIED_SETTINGS.persistComposerContextStrip
      ? [currentTranslator()("settingsC.restoreComposerContext")]
      : []),
    ...getChangedTypographySettingLabels(settings),
    ...(settings.diffFilesCollapsed !== DEFAULT_UNIFIED_SETTINGS.diffFilesCollapsed
      ? [currentTranslator()("settingsC.restoreDefaultDiffFileState")]
      : []),
    ...(settings.diffIgnoreWhitespace !== DEFAULT_UNIFIED_SETTINGS.diffIgnoreWhitespace
      ? [currentTranslator()("settingsC.restoreDiffWhitespace")]
      : []),
    ...(settings.diffLayout !== DEFAULT_UNIFIED_SETTINGS.diffLayout
      ? [currentTranslator()("settingsC.restoreDiffLayout")]
      : []),
    ...(settings.proactivePanelsEnabled !== DEFAULT_UNIFIED_SETTINGS.proactivePanelsEnabled
      ? [currentTranslator()("settingsC.restoreProactivePanels")]
      : []),
    ...(settings.showSkillsInSlashMenu !== DEFAULT_UNIFIED_SETTINGS.showSkillsInSlashMenu
      ? [currentTranslator()("settingsC.restoreSkillsInSlash")]
      : []),
    ...(settings.composerCollapseOnScroll !== DEFAULT_UNIFIED_SETTINGS.composerCollapseOnScroll
      ? [currentTranslator()("settingsC.restoreCollapseComposer")]
      : []),
    ...(settings.composerRichTextEnabled !== DEFAULT_UNIFIED_SETTINGS.composerRichTextEnabled
      ? [currentTranslator()("settingsC.restoreRichText")]
      : []),
    ...(settings.sendShortcut !== DEFAULT_UNIFIED_SETTINGS.sendShortcut
      ? [currentTranslator()("settingsC.restoreSendShortcut")]
      : []),
    ...(settings.followUpBehavior !== DEFAULT_UNIFIED_SETTINGS.followUpBehavior
      ? [currentTranslator()("settingsC.restoreFollowUpBehavior")]
      : []),
    ...(settings.contextWindowMeterEnabled !== DEFAULT_UNIFIED_SETTINGS.contextWindowMeterEnabled
      ? [currentTranslator()("settingsC.restoreContextWindowIndicator")]
      : []),
    ...(settings.responseStreamingMode !== DEFAULT_UNIFIED_SETTINGS.responseStreamingMode
      ? [currentTranslator()("settingsC.restoreResponseStreaming")]
      : []),
    ...(settings.enableProviderUpdateChecks !== DEFAULT_UNIFIED_SETTINGS.enableProviderUpdateChecks
      ? [currentTranslator()("settingsC.restoreProviderUpdateChecks")]
      : []),
    ...(settings.continueThreadsAfterServerUpdate !==
    DEFAULT_UNIFIED_SETTINGS.continueThreadsAfterServerUpdate
      ? [currentTranslator()("settingsC.restoreContinueAfterRestarts")]
      : []),
    ...(isBackgroundActivityDirty
      ? [currentTranslator()("settingsC.restoreBackgroundActivity")]
      : []),
    ...(settings.defaultThreadEnvMode !== DEFAULT_UNIFIED_SETTINGS.defaultThreadEnvMode
      ? [currentTranslator()("settingsC.restoreNewThreadMode")]
      : []),
    ...(settings.newWorktreesStartFromOrigin !==
    DEFAULT_UNIFIED_SETTINGS.newWorktreesStartFromOrigin
      ? [currentTranslator()("settingsC.restoreWorktreesFromOrigin")]
      : []),
    ...(settings.addProjectBaseDirectory !== DEFAULT_UNIFIED_SETTINGS.addProjectBaseDirectory
      ? [currentTranslator()("settingsC.restoreAddProjectBaseDir")]
      : []),
    ...(settings.confirmThreadUnpin !== DEFAULT_UNIFIED_SETTINGS.confirmThreadUnpin
      ? [currentTranslator()("settingsC.restoreUnpinConfirmation")]
      : []),
    ...(settings.confirmThreadArchive !== DEFAULT_UNIFIED_SETTINGS.confirmThreadArchive
      ? [currentTranslator()("settingsC.restoreArchiveConfirmation")]
      : []),
    ...(settings.confirmThreadDelete !== DEFAULT_UNIFIED_SETTINGS.confirmThreadDelete
      ? [currentTranslator()("settingsC.restoreDeleteConfirmation")]
      : []),
    ...(settings.confirmQuit !== DEFAULT_UNIFIED_SETTINGS.confirmQuit ? ["Quit shortcut"] : []),
    ...(isTextGenerationModelDirty ? ["Text generation model"] : []),
    ...(settings.threadTitleInstructions !== DEFAULT_UNIFIED_SETTINGS.threadTitleInstructions
      ? ["Thread title instructions"]
      : []),
    ...getChangedBrowserSettingLabels(settings),
    ...(settings.enableAgentBrowserAccess !== DEFAULT_UNIFIED_SETTINGS.enableAgentBrowserAccess
      ? [currentTranslator()("settingsC.restoreAgentBrowserAccess")]
      : []),
  ];

  const restoreDefaults = async () => {
    if (changedSettingLabels.length === 0) return;
    const api = readLocalApi();
    const confirmed = await (api ?? ensureLocalApi()).dialogs.confirm(
      [
        currentTranslator()("settingsC.restoreDefaultsTitle"),
        currentTranslator()("settingsC.restoreDefaultsBody", {
          labels: changedSettingLabels.join(", "),
        }),
      ].join("\n"),
      { variant: "destructive" },
    );
    if (!confirmed) return;

    // Reset only dirty theme keys so storage failures cannot block other settings; re-read after confirmation
    // for safe rollback.
    let previousTheme = theme;
    try {
      previousTheme = readThemePreference();
    } catch {}
    const liveHalves = readThemeHalves();
    const needsThemeReset = previousTheme !== "system";
    const needsMixReset = liveHalves !== null;
    const needsFollowSystemReset = readAppearanceModePreference(previousTheme) !== "system";
    const notifyThemeRestoreFailure = () => {
      toastManager.add(
        stackedThreadToast({
          type: "error",
          title: t("settingsC.couldNotRestoreTheme"),
          description: t("settingsC.tryAgainPeriod"),
        }),
      );
    };
    // Restore the base preference before the mix because restoring the base clears the mix.
    const previousHalves = liveHalves;
    const rollbackThemeState = () => {
      if (needsThemeReset) setTheme(previousTheme);
      if (previousHalves?.light) setThemeHalf("light", previousHalves.light);
      if (previousHalves?.dark) setThemeHalf("dark", previousHalves.dark);
    };
    if (needsThemeReset && !setTheme("system")) {
      notifyThemeRestoreFailure();
      return;
    }
    if (needsMixReset && !clearThemeHalves()) {
      rollbackThemeState();
      notifyThemeRestoreFailure();
      return;
    }
    if (needsFollowSystemReset && !setFollowSystem(true)) {
      rollbackThemeState();
      notifyThemeRestoreFailure();
      return;
    }
    updateSettings({
      appearanceContrast: DEFAULT_UNIFIED_SETTINGS.appearanceContrast,
      diffColorScheme: DEFAULT_UNIFIED_SETTINGS.diffColorScheme,
      chatWidth: DEFAULT_UNIFIED_SETTINGS.chatWidth,
      interfaceLanguage: DEFAULT_UNIFIED_SETTINGS.interfaceLanguage,
      displayCurrency: DEFAULT_UNIFIED_SETTINGS.displayCurrency,
      mathRenderingEnabled: DEFAULT_UNIFIED_SETTINGS.mathRenderingEnabled,
      redesignEnabled: DEFAULT_UNIFIED_SETTINGS.redesignEnabled,
      timestampFormat: DEFAULT_UNIFIED_SETTINGS.timestampFormat,
      notificationMode: DEFAULT_UNIFIED_SETTINGS.notificationMode,
      inAppNotificationsEnabled: DEFAULT_UNIFIED_SETTINGS.inAppNotificationsEnabled,
      wordWrap: DEFAULT_UNIFIED_SETTINGS.wordWrap,
      persistComposerContextStrip: DEFAULT_UNIFIED_SETTINGS.persistComposerContextStrip,
      diffFilesCollapsed: DEFAULT_UNIFIED_SETTINGS.diffFilesCollapsed,
      diffIgnoreWhitespace: DEFAULT_UNIFIED_SETTINGS.diffIgnoreWhitespace,
      diffLayout: DEFAULT_UNIFIED_SETTINGS.diffLayout,
      proactivePanelsEnabled: DEFAULT_UNIFIED_SETTINGS.proactivePanelsEnabled,
      showSkillsInSlashMenu: DEFAULT_UNIFIED_SETTINGS.showSkillsInSlashMenu,
      composerCollapseOnScroll: DEFAULT_UNIFIED_SETTINGS.composerCollapseOnScroll,
      composerRichTextEnabled: DEFAULT_UNIFIED_SETTINGS.composerRichTextEnabled,
      sendShortcut: DEFAULT_UNIFIED_SETTINGS.sendShortcut,
      followUpBehavior: DEFAULT_UNIFIED_SETTINGS.followUpBehavior,
      contextWindowMeterEnabled: DEFAULT_UNIFIED_SETTINGS.contextWindowMeterEnabled,
      environmentIdentificationMode: DEFAULT_UNIFIED_SETTINGS.environmentIdentificationMode,
      glassOpacity: DEFAULT_UNIFIED_SETTINGS.glassOpacity,
      panelAnimationDurationMs: DEFAULT_UNIFIED_SETTINGS.panelAnimationDurationMs,
      sidebarThreadPreviewCount: DEFAULT_UNIFIED_SETTINGS.sidebarThreadPreviewCount,
      sidebarProjectGroupingMode: DEFAULT_UNIFIED_SETTINGS.sidebarProjectGroupingMode,
      sidebarProjectSortOrder: DEFAULT_UNIFIED_SETTINGS.sidebarProjectSortOrder,
      sidebarWorkingShelfEnabled: DEFAULT_UNIFIED_SETTINGS.sidebarWorkingShelfEnabled,
      sidebarAutoSettleAfterDays: DEFAULT_UNIFIED_SETTINGS.sidebarAutoSettleAfterDays,
      sidebarAutoSettleKeepPullRequests: DEFAULT_UNIFIED_SETTINGS.sidebarAutoSettleKeepPullRequests,
      sidebarAutoSettleOnMerge: DEFAULT_UNIFIED_SETTINGS.sidebarAutoSettleOnMerge,
      autoResumeLimitedThreads: DEFAULT_UNIFIED_SETTINGS.autoResumeLimitedThreads,
      snoozeLimitedThreads: DEFAULT_UNIFIED_SETTINGS.snoozeLimitedThreads,
      responseStreamingMode: DEFAULT_UNIFIED_SETTINGS.responseStreamingMode,
      enableProviderUpdateChecks: DEFAULT_UNIFIED_SETTINGS.enableProviderUpdateChecks,
      continueThreadsAfterServerUpdate: DEFAULT_UNIFIED_SETTINGS.continueThreadsAfterServerUpdate,
      backgroundActivity: DEFAULT_UNIFIED_SETTINGS.backgroundActivity,
      backgroundActivityProfile: DEFAULT_UNIFIED_SETTINGS.backgroundActivityProfile,
      automaticGitFetchInterval: DEFAULT_UNIFIED_SETTINGS.automaticGitFetchInterval,
      providerHealthRefreshInterval: DEFAULT_UNIFIED_SETTINGS.providerHealthRefreshInterval,
      defaultThreadEnvMode: DEFAULT_UNIFIED_SETTINGS.defaultThreadEnvMode,
      newWorktreesStartFromOrigin: DEFAULT_UNIFIED_SETTINGS.newWorktreesStartFromOrigin,
      addProjectBaseDirectory: DEFAULT_UNIFIED_SETTINGS.addProjectBaseDirectory,
      confirmThreadArchive: DEFAULT_UNIFIED_SETTINGS.confirmThreadArchive,
      confirmThreadDelete: DEFAULT_UNIFIED_SETTINGS.confirmThreadDelete,
      confirmThreadUnpin: DEFAULT_UNIFIED_SETTINGS.confirmThreadUnpin,
      confirmQuit: DEFAULT_UNIFIED_SETTINGS.confirmQuit,
      textGenerationModelSelection: DEFAULT_UNIFIED_SETTINGS.textGenerationModelSelection,
      threadTitleInstructions: DEFAULT_UNIFIED_SETTINGS.threadTitleInstructions,
      fontFamilySans: DEFAULT_UNIFIED_SETTINGS.fontFamilySans,
      fontFamilyComposer: DEFAULT_UNIFIED_SETTINGS.fontFamilyComposer,
      fontFamilyCode: DEFAULT_UNIFIED_SETTINGS.fontFamilyCode,
      fontFamilyTerminal: DEFAULT_UNIFIED_SETTINGS.fontFamilyTerminal,
      fontSizeInterface: DEFAULT_UNIFIED_SETTINGS.fontSizeInterface,
      fontSizePrompt: DEFAULT_UNIFIED_SETTINGS.fontSizePrompt,
      fontSizeCode: DEFAULT_UNIFIED_SETTINGS.fontSizeCode,
      fontSizeTerminal: DEFAULT_UNIFIED_SETTINGS.fontSizeTerminal,
      browserDefaultViewport: DEFAULT_UNIFIED_SETTINGS.browserDefaultViewport,
      browserDefaultZoomFactor: DEFAULT_UNIFIED_SETTINGS.browserDefaultZoomFactor,
      browserDefaultAppearance: DEFAULT_UNIFIED_SETTINGS.browserDefaultAppearance,
      browserRecordingFrameRate: DEFAULT_UNIFIED_SETTINGS.browserRecordingFrameRate,
      browserRecordingShowKeyPresses: DEFAULT_UNIFIED_SETTINGS.browserRecordingShowKeyPresses,
      browserRecordingShowMousePresses: DEFAULT_UNIFIED_SETTINGS.browserRecordingShowMousePresses,
      browserLinkTarget: DEFAULT_UNIFIED_SETTINGS.browserLinkTarget,
      browserSearchEngine: DEFAULT_UNIFIED_SETTINGS.browserSearchEngine,
      browserCustomSearchUrl: DEFAULT_UNIFIED_SETTINGS.browserCustomSearchUrl,
      browserAutoShowFloatingPreview: DEFAULT_UNIFIED_SETTINGS.browserAutoShowFloatingPreview,
      pullRequestLinksOpenInApp: DEFAULT_UNIFIED_SETTINGS.pullRequestLinksOpenInApp,
      enableAgentBrowserAccess: DEFAULT_UNIFIED_SETTINGS.enableAgentBrowserAccess,
    });
    onRestored?.();
  };

  return {
    changedSettingLabels,
    restoreDefaults,
  };
}

const AUTO_SETTLE_DEFAULT_DAYS = DEFAULT_UNIFIED_SETTINGS.sidebarAutoSettleAfterDays ?? 3;

function AutoSettleDaysInput({
  value,
  onCommit,
}: {
  value: number;
  onCommit: (days: number) => void;
}) {
  const t = useT();
  const [draft, setDraft] = useState(String(value));
  const [draftSource, setDraftSource] = useState(value);
  if (draftSource !== value) {
    setDraftSource(value);
    setDraft(String(value));
  }

  return (
    <Input
      size="sm"
      type="number"
      min={MIN_SIDEBAR_AUTO_SETTLE_AFTER_DAYS}
      max={MAX_SIDEBAR_AUTO_SETTLE_AFTER_DAYS}
      className="w-full sm:w-24"
      value={draft}
      onChange={(event) => {
        setDraft(event.target.value);
        const parsed = Number(event.target.value);
        if (
          Number.isInteger(parsed) &&
          parsed >= MIN_SIDEBAR_AUTO_SETTLE_AFTER_DAYS &&
          parsed <= MAX_SIDEBAR_AUTO_SETTLE_AFTER_DAYS
        ) {
          onCommit(parsed);
        }
      }}
      onBlur={() => setDraft(String(value))}
      aria-label={t("settingsC.inactivityDaysBeforeSettle")}
    />
  );
}

const LEGACY_FEATURE_TARGET_IDS: ReadonlySet<string> = new Set([
  "legacy-plan-mode",
  "legacy-context-window-indicator",
  "legacy-sidebar",
]);

function LegacyFeaturesSection() {
  const t = useT();
  const settings = useScopedSettings();
  const updateSettings = useUpdateScopedSettings();
  const [open, setOpen] = useState(false);
  const searchTargetId = useSettingsSearchTargetId();
  const targetRef = useSettingsSearchTarget<HTMLElement>("legacy-features");
  // A search jump to a legacy setting opens the fold before its row mounts.
  const [seenSearchTargetId, setSeenSearchTargetId] = useState<string | null>(null);
  if (seenSearchTargetId !== searchTargetId) {
    setSeenSearchTargetId(searchTargetId);
    if (searchTargetId !== null && LEGACY_FEATURE_TARGET_IDS.has(searchTargetId)) setOpen(true);
  }

  return (
    <section id="legacy-features" ref={targetRef} tabIndex={-1} className="space-y-2.5">
      <Collapsible open={open} onOpenChange={setOpen}>
        <CollapsibleTrigger className="group flex min-h-8 w-full items-center gap-2 px-3 sm:px-4">
          <h2 className="text-sm font-normal text-foreground/70 transition-colors group-hover:text-foreground">
            {t("settingsC.legacyFeatures")}
          </h2>
          <ChevronRightIcon className="size-4 text-muted-foreground transition-transform duration-200 group-data-panel-open:rotate-90" />
        </CollapsibleTrigger>
        <CollapsiblePanel>
          <SettingsGroup>
            <SettingsRow
              {...searchableSetting("legacy-plan-mode")}
              description={t("settingsC.restoreBuildPlan")}
              control={
                <Switch
                  checked={settings.planModeEnabled}
                  onCheckedChange={(checked) => {
                    updateSettings({ planModeEnabled: Boolean(checked) });
                  }}
                  aria-label={t("settingsC.planModeLegacy")}
                />
              }
            />
            <SettingsRow
              {...searchableSetting("legacy-context-window-indicator")}
              description={t("settingsC.contextWindowIndicatorNote")}
              control={
                <Switch
                  checked={settings.contextWindowMeterEnabled}
                  onCheckedChange={(checked) =>
                    updateSettings({ contextWindowMeterEnabled: Boolean(checked) })
                  }
                  aria-label={t("settingsC.contextWindowIndicatorLegacy")}
                />
              }
            />
            <SettingsRow
              {...searchableSetting("legacy-sidebar")}
              description={t("settingsC.restoreThreadTrees")}
              control={
                <Switch
                  checked={settings.legacySidebarEnabled}
                  onCheckedChange={(checked) =>
                    updateSettings({ legacySidebarEnabled: Boolean(checked) })
                  }
                  aria-label={t("settingsC.sidebarLegacy")}
                />
              }
            />
          </SettingsGroup>
        </CollapsiblePanel>
      </Collapsible>
    </section>
  );
}

export function GeneralSettingsPanel() {
  const t = useT();
  const modifierLabel = isMacPlatform(navigator.platform) ? "⌘" : "Ctrl";
  const sendShortcutOptions = [
    { value: "enter", label: t("settingsC.enterKey") },
    {
      value: "mod-enter-multiline",
      label: t("settingsC.modifierEnterMultiline", { modifier: modifierLabel }),
    },
    { value: "mod-enter", label: t("settingsC.modifierEnterAlways", { modifier: modifierLabel }) },
  ] as const;
  const settings = useScopedSettings();
  const updateSettings = useUpdateScopedSettings();
  const navigate = useNavigate();
  const { scope, environment, connectedEnvironments, target, targets } = useSettingsScope();
  const idleCompaction = scopedIdleCompaction(targets.length > 0 ? targets : [{ settings }]);
  const environmentId = environment?.environmentId ?? null;
  const isEnvironmentScope = scope.environmentIds.length === 1 && environmentId !== null;
  const hasServerTargets = connectedEnvironments.length > 0;
  const mixedResponseStreamingMode = useScopedSettingsMixed(["responseStreamingMode"]);
  const lastEnabledProjectGroupingMode = useRef<SidebarProjectGroupingMode>(
    readLastEnabledProjectGroupingMode(),
  );
  const providersByEnvironment = useEnvironmentProviders();
  const serverProviders =
    (environment?.serverConfig
      ? providersByEnvironment.get(environment.environmentId)
      : undefined) ?? EMPTY_SERVER_PROVIDERS;
  const supportsAutoSettlement =
    connectedEnvironments.length > 0 &&
    connectedEnvironments.every(
      (target) => target.serverConfig?.environment.capabilities.threadAutoSettlement === true,
    );
  const supportsAutoSettlementScope = connectedEnvironments.every(
    (target) => target.serverConfig?.environment.capabilities.threadAutoSettlementScope === true,
  );
  const supportsRestartContinuation =
    connectedEnvironments.length > 0 &&
    connectedEnvironments.every(
      (target) => target.serverConfig?.environment.capabilities.threadRestartContinuation === true,
    );

  const textGenerationProviders = serverProviders.filter(
    (provider) => provider.supportsTextGeneration !== false,
  );
  const textGenerationModelSelection = resolveAppModelSelectionState(
    settings,
    textGenerationProviders,
  );
  const textGenInstanceId = textGenerationModelSelection.instanceId;
  const textGenModel = textGenerationModelSelection.model;
  const textGenModelOptions = textGenerationModelSelection.options;
  const textGenerationModelInstanceEntries = sortProviderInstanceEntries(
    applyProviderInstanceSettings(
      deriveProviderInstanceEntries(textGenerationProviders),
      settings,
      target?.projectId ?? null,
    ),
  );
  const hasTextGenerationProvider = textGenerationModelInstanceEntries.some(
    (entry) => entry.enabled && entry.isAvailable,
  );
  const textGenInstanceEntry = textGenerationModelInstanceEntries.find(
    (entry) => entry.instanceId === textGenInstanceId,
  );
  const textGenProvider: ProviderDriverKind =
    textGenInstanceEntry?.driverKind ?? DEFAULT_DRIVER_KIND;
  const textGenerationModelOptionsByInstance = getCustomModelOptionsByInstance(
    settings,
    textGenerationProviders,
    textGenInstanceId,
    textGenModel,
  );
  const isTextGenerationModelDirty = !Equal.equals(
    settings.textGenerationModelSelection ?? null,
    DEFAULT_UNIFIED_SETTINGS.textGenerationModelSelection ?? null,
  );
  const textGenerationModelDisabledReason = useScopedModelDisabledReason(
    settings,
    textGenerationModelInstanceEntries,
  );
  const mixedAddProjectBaseDirectory = useScopedSettingsMixed(["addProjectBaseDirectory"]);
  const mixedTextGenerationModel = useScopedSettingsMixed(["textGenerationModelSelection"]);

  return (
    <SettingsPageContainer>
      <ProjectDefaultsSettings category="general" />
      <SettingsSection id="organization" title={t("settingsC.organization")}>
        <SettingsRow
          {...searchableSetting("project-grouping")}
          description={t("settingsC.combineRepos")}
          resetAction={
            settings.sidebarProjectGroupingMode !==
            DEFAULT_UNIFIED_SETTINGS.sidebarProjectGroupingMode ? (
              <SettingResetButton
                label={t("settingsC.labelProjectGrouping")}
                onClick={() =>
                  updateSettings({
                    sidebarProjectGroupingMode: DEFAULT_UNIFIED_SETTINGS.sidebarProjectGroupingMode,
                  })
                }
              />
            ) : null
          }
          control={
            <Switch
              checked={isProjectGroupingEnabled(settings.sidebarProjectGroupingMode)}
              onCheckedChange={(checked) => {
                if (!checked && settings.sidebarProjectGroupingMode !== "separate") {
                  lastEnabledProjectGroupingMode.current = settings.sidebarProjectGroupingMode;
                  rememberEnabledProjectGroupingMode(settings.sidebarProjectGroupingMode);
                }
                updateSettings({
                  sidebarProjectGroupingMode: projectGroupingModeFromToggle(
                    checked,
                    lastEnabledProjectGroupingMode.current,
                  ),
                });
              }}
              aria-label={t("settingsC.projectGrouping")}
            />
          }
        />
        <SettingsRow
          {...searchableSetting("project-order")}
          description={t("settingsC.projectOrderNote")}
          resetAction={
            settings.sidebarProjectSortOrder !==
            DEFAULT_UNIFIED_SETTINGS.sidebarProjectSortOrder ? (
              <SettingResetButton
                label={t("settingsC.labelProjectOrder")}
                onClick={() =>
                  updateSettings({
                    sidebarProjectSortOrder: DEFAULT_UNIFIED_SETTINGS.sidebarProjectSortOrder,
                  })
                }
              />
            ) : null
          }
          control={
            <Select
              value={settings.sidebarProjectSortOrder}
              onValueChange={(value) => {
                if (isSidebarProjectSortOrder(value)) {
                  updateSettings({ sidebarProjectSortOrder: value });
                }
              }}
            >
              <SelectTrigger
                size="sm"
                className="w-full sm:w-44"
                aria-label={t("settingsC.projectOrder")}
              >
                <SelectValue>
                  {SIDEBAR_PROJECT_SORT_ORDER_LABELS[settings.sidebarProjectSortOrder]}
                </SelectValue>
              </SelectTrigger>
              <SelectPopup align="end" alignItemWithTrigger={false}>
                {SidebarProjectSortOrder.literals.map((sortOrder) => (
                  <SelectItem hideIndicator key={sortOrder} value={sortOrder}>
                    {SIDEBAR_PROJECT_SORT_ORDER_LABELS[sortOrder]}
                  </SelectItem>
                ))}
              </SelectPopup>
            </Select>
          }
        />

        <SettingsRow
          serverScoped
          {...searchableSetting("auto-resume-limited-threads")}
          description={t("settingsC.resumeUsageLimit")}
          settingKeys={["autoResumeLimitedThreads"]}
          control={
            <ScopedSwitch
              settingKeys={["autoResumeLimitedThreads"]}
              checked={settings.autoResumeLimitedThreads}
              onCheckedChange={(checked) =>
                updateSettings({ autoResumeLimitedThreads: Boolean(checked) })
              }
              aria-label={currentTranslator()("updates.resumeAfterUsageLimits")}
            />
          }
        />
        <SettingsRow
          serverScoped
          {...searchableSetting("snooze-limited-threads")}
          description={currentTranslator()("updates.snoozeUsageLimitStopsUntilResetPairWith")}
          settingKeys={["snoozeLimitedThreads"]}
          control={
            <ScopedSwitch
              settingKeys={["snoozeLimitedThreads"]}
              checked={settings.snoozeLimitedThreads}
              onCheckedChange={(checked) =>
                updateSettings({ snoozeLimitedThreads: Boolean(checked) })
              }
              aria-label={currentTranslator()("updates.snoozeUntilLimitsReset")}
            />
          }
        />

        <SettingsRow
          serverScoped
          settingKeys={["idleCompaction", "compactIdleThreads"]}
          mixed={idleCompaction.mixed}
          {...searchableSetting("compact-idle-threads")}
          description={currentTranslator()("updates.whenToCompactAnIdleClaudeThreadOver")}
          resetAction={
            globalIdleCompaction(settings) !== globalIdleCompaction(DEFAULT_UNIFIED_SETTINGS) ? (
              <SettingResetButton
                label="compact idle threads"
                onClick={() =>
                  updateSettings({ idleCompaction: globalIdleCompaction(DEFAULT_UNIFIED_SETTINGS) })
                }
              />
            ) : null
          }
          control={
            <Select
              value={idleCompaction.mixed ? null : globalIdleCompaction(settings)}
              onValueChange={(value) => {
                const mode = IDLE_COMPACTION_MODES.find((candidate) => candidate.value === value);
                if (mode) updateSettings({ idleCompaction: mode.value });
              }}
            >
              <SelectTrigger
                size="sm"
                className="w-full sm:w-56"
                aria-label={currentTranslator()("updates.compactIdleThreads")}
              >
                <SelectValue>
                  {(value: string | null) =>
                    value === null
                      ? "Mixed"
                      : IDLE_COMPACTION_MODES.find((mode) => mode.value === value)?.label
                  }
                </SelectValue>
              </SelectTrigger>
              <SelectPopup align="end" alignItemWithTrigger={false}>
                {IDLE_COMPACTION_MODES.map((mode) => (
                  <SelectItem
                    hideIndicator
                    key={mode.value}
                    value={mode.value}
                    // A server from before modes has only the on/off switch, so it cannot store "Never".
                    disabled={mode.value === "off" && !idleCompaction.neverAvailable}
                  >
                    {mode.label}
                  </SelectItem>
                ))}
              </SelectPopup>
            </Select>
          }
        />

        {supportsAutoSettlement ? (
          <>
            <SettingsRow
              serverScoped
              settingKeys={["sidebarAutoSettleOnMerge"]}
              {...searchableSetting("auto-settle-merged-threads")}
              description={t("settingsC.settleOnMerge")}
              resetAction={
                settings.sidebarAutoSettleOnMerge !==
                DEFAULT_UNIFIED_SETTINGS.sidebarAutoSettleOnMerge ? (
                  <SettingResetButton
                    label={t("settingsC.labelAutoSettleOnMerge")}
                    onClick={() =>
                      updateSettings({
                        sidebarAutoSettleOnMerge: DEFAULT_UNIFIED_SETTINGS.sidebarAutoSettleOnMerge,
                      })
                    }
                  />
                ) : null
              }
              control={
                <ScopedSwitch
                  settingKeys={["sidebarAutoSettleOnMerge"]}
                  checked={settings.sidebarAutoSettleOnMerge}
                  onCheckedChange={(checked) =>
                    updateSettings({ sidebarAutoSettleOnMerge: Boolean(checked) })
                  }
                  aria-label={t("settingsC.autoSettleMerged")}
                />
              }
            />

            <SettingsRow
              serverScoped
              settingKeys={["sidebarAutoSettleAfterDays"]}
              {...searchableSetting("auto-settle-inactive-threads")}
              description={t("settingsC.autoSettleInactivityNote")}
              resetAction={
                settings.sidebarAutoSettleAfterDays !==
                DEFAULT_UNIFIED_SETTINGS.sidebarAutoSettleAfterDays ? (
                  <SettingResetButton
                    label={t("settingsC.labelAutoSettle")}
                    onClick={() =>
                      updateSettings({
                        sidebarAutoSettleAfterDays:
                          DEFAULT_UNIFIED_SETTINGS.sidebarAutoSettleAfterDays,
                      })
                    }
                  />
                ) : null
              }
              control={
                <ScopedSwitch
                  settingKeys={["sidebarAutoSettleAfterDays"]}
                  checked={settings.sidebarAutoSettleAfterDays !== null}
                  onCheckedChange={(checked) =>
                    updateSettings({
                      sidebarAutoSettleAfterDays: checked ? AUTO_SETTLE_DEFAULT_DAYS : null,
                    })
                  }
                  aria-label={t("settingsC.autoSettleInactive")}
                />
              }
            />
            {settings.sidebarAutoSettleAfterDays !== null ? (
              <SettingsRow
                serverScoped
                settingKeys={["sidebarAutoSettleAfterDays"]}
                title={searchableSetting("days-before-auto-settle").title}
                description={t("settingsC.anyActivityUnsettles")}
                control={
                  <AutoSettleDaysInput
                    value={settings.sidebarAutoSettleAfterDays}
                    onCommit={(days) => updateSettings({ sidebarAutoSettleAfterDays: days })}
                  />
                }
              />
            ) : null}
            {settings.sidebarAutoSettleAfterDays !== null && supportsAutoSettlementScope ? (
              <SettingsRow
                serverScoped
                settingKeys={["sidebarAutoSettleKeepPullRequests"]}
                title={t("settingsC.keepPrThreads")}
                description={t("settingsC.inactivityNoSettlePr")}
                control={
                  <ScopedSwitch
                    settingKeys={["sidebarAutoSettleKeepPullRequests"]}
                    checked={settings.sidebarAutoSettleKeepPullRequests}
                    onCheckedChange={(checked) =>
                      updateSettings({ sidebarAutoSettleKeepPullRequests: checked })
                    }
                    aria-label={t("settingsC.keepPrThreads")}
                  />
                }
              />
            ) : null}
          </>
        ) : null}
      </SettingsSection>

      <SettingsSection id="behavior" title={t("settingsC.behavior")}>
        <NotificationSettings />
        <SettingsRow
          {...searchableSetting("in-app-notifications")}
          description={t("settingsC.toastOnThreadEvent")}
          control={
            <Switch
              checked={settings.inAppNotificationsEnabled}
              onCheckedChange={(checked) => updateSettings({ inAppNotificationsEnabled: checked })}
              aria-label={t("settingsC.inAppNotifications")}
            />
          }
        />
        <LanguageSetting />
        <CurrencySetting />
        <SettingsRow
          {...searchableSetting("time-format")}
          description={t("settingsC.systemDefaultClock")}
          resetAction={
            settings.timestampFormat !== DEFAULT_UNIFIED_SETTINGS.timestampFormat ? (
              <SettingResetButton
                label={t("settingsC.labelTimeFormat")}
                onClick={() =>
                  updateSettings({
                    timestampFormat: DEFAULT_UNIFIED_SETTINGS.timestampFormat,
                  })
                }
              />
            ) : null
          }
          control={
            <Select
              value={settings.timestampFormat}
              onValueChange={(value) => {
                if (value === "locale" || value === "12-hour" || value === "24-hour") {
                  updateSettings({ timestampFormat: value });
                }
              }}
            >
              <SelectTrigger
                size="sm"
                className="w-full sm:w-40"
                aria-label={t("settingsC.timestampFormat")}
              >
                <SelectValue>{TIMESTAMP_FORMAT_LABELS[settings.timestampFormat]}</SelectValue>
              </SelectTrigger>
              <SelectPopup align="end" alignItemWithTrigger={false}>
                <SelectItem hideIndicator value="locale">
                  {TIMESTAMP_FORMAT_LABELS.locale}
                </SelectItem>
                <SelectItem hideIndicator value="12-hour">
                  {TIMESTAMP_FORMAT_LABELS["12-hour"]}
                </SelectItem>
                <SelectItem hideIndicator value="24-hour">
                  {TIMESTAMP_FORMAT_LABELS["24-hour"]}
                </SelectItem>
              </SelectPopup>
            </Select>
          }
        />
        <SettingsRow
          serverScoped
          settingKeys={["responseStreamingMode"]}
          {...searchableSetting("response-streaming")}
          description={
            mixedResponseStreamingMode
              ? t("settingsC.streamingModesDiffer")
              : RESPONSE_STREAMING_MODE_DESCRIPTIONS[settings.responseStreamingMode]
          }
          resetAction={
            settings.responseStreamingMode !== DEFAULT_UNIFIED_SETTINGS.responseStreamingMode ? (
              <SettingResetButton
                label={t("settingsC.labelResponseStreaming")}
                onClick={() =>
                  updateSettings({
                    responseStreamingMode: DEFAULT_UNIFIED_SETTINGS.responseStreamingMode,
                  })
                }
              />
            ) : null
          }
          control={
            <Select
              value={mixedResponseStreamingMode ? null : settings.responseStreamingMode}
              onValueChange={(value) => {
                if (value === "turn" || value === "paragraph") {
                  updateSettings({ responseStreamingMode: value });
                }
              }}
            >
              <SelectTrigger
                size="sm"
                className="w-full sm:w-56"
                aria-label={t("settingsC.responseStreaming")}
              >
                <SelectValue>
                  {(value: ResponseStreamingMode | null) =>
                    value === null
                      ? currentTranslator()("settingsC.mixed")
                      : RESPONSE_STREAMING_MODE_LABELS[value]
                  }
                </SelectValue>
              </SelectTrigger>
              <SelectPopup align="end" alignItemWithTrigger={false}>
                <SelectItem hideIndicator value="turn">
                  {RESPONSE_STREAMING_MODE_LABELS.turn}
                </SelectItem>
                <SelectItem hideIndicator value="paragraph">
                  {RESPONSE_STREAMING_MODE_LABELS.paragraph}
                </SelectItem>
              </SelectPopup>
            </Select>
          }
        />
        <SettingsRow
          {...searchableSetting("hide-whitespace-changes")}
          description={t("settingsC.diffIgnoresWhitespace")}
          resetAction={
            settings.diffIgnoreWhitespace !== DEFAULT_UNIFIED_SETTINGS.diffIgnoreWhitespace ? (
              <SettingResetButton
                label={t("settingsC.labelDiffWhitespace")}
                onClick={() =>
                  updateSettings({
                    diffIgnoreWhitespace: DEFAULT_UNIFIED_SETTINGS.diffIgnoreWhitespace,
                  })
                }
              />
            ) : null
          }
          control={
            <Switch
              checked={settings.diffIgnoreWhitespace}
              onCheckedChange={(checked) =>
                updateSettings({ diffIgnoreWhitespace: Boolean(checked) })
              }
              aria-label={t("settingsC.hideWhitespaceDefault")}
            />
          }
        />
        <SettingsRow
          {...searchableSetting("default-diff-file-state")}
          description={t("settingsC.startFilesExpanded")}
          resetAction={
            settings.diffFilesCollapsed !== DEFAULT_UNIFIED_SETTINGS.diffFilesCollapsed ? (
              <SettingResetButton
                label={t("settingsC.labelDefaultDiffFileState")}
                onClick={() =>
                  updateSettings({
                    diffFilesCollapsed: DEFAULT_UNIFIED_SETTINGS.diffFilesCollapsed,
                  })
                }
              />
            ) : null
          }
          control={
            <Select
              value={settings.diffFilesCollapsed ? "collapsed" : "expanded"}
              onValueChange={(value) => {
                if (value === "expanded" || value === "collapsed") {
                  updateSettings({ diffFilesCollapsed: value === "collapsed" });
                }
              }}
            >
              <SelectTrigger
                size="sm"
                className="w-full sm:w-40"
                aria-label={t("settingsC.defaultDiffFileState")}
              >
                <SelectValue>
                  {settings.diffFilesCollapsed ? t("settingsC.collapsed") : t("settingsC.expanded")}
                </SelectValue>
              </SelectTrigger>
              <SelectPopup align="end" alignItemWithTrigger={false}>
                <SelectItem hideIndicator value="expanded">
                  {t("settingsC.expanded")}
                </SelectItem>
                <SelectItem hideIndicator value="collapsed">
                  {t("settingsC.collapsed")}
                </SelectItem>
              </SelectPopup>
            </Select>
          }
        />
        <SettingsRow
          {...searchableSetting("diff-layout")}
          description={t("settingsC.showDiffsStacked")}
          resetAction={
            settings.diffLayout !== DEFAULT_UNIFIED_SETTINGS.diffLayout ? (
              <SettingResetButton
                label={t("settingsC.labelDiffLayout")}
                onClick={() => updateSettings({ diffLayout: DEFAULT_UNIFIED_SETTINGS.diffLayout })}
              />
            ) : null
          }
          control={
            <Select
              value={settings.diffLayout}
              onValueChange={(value) => {
                if (value === "stacked" || value === "split") {
                  updateSettings({ diffLayout: value });
                }
              }}
            >
              <SelectTrigger
                size="sm"
                className="w-full sm:w-40"
                aria-label={t("settingsC.diffLayout")}
              >
                <SelectValue>{DIFF_LAYOUT_LABELS[settings.diffLayout]}</SelectValue>
              </SelectTrigger>
              <SelectPopup align="end" alignItemWithTrigger={false}>
                <SelectItem hideIndicator value="stacked">
                  {DIFF_LAYOUT_LABELS.stacked}
                </SelectItem>
                <SelectItem hideIndicator value="split">
                  {DIFF_LAYOUT_LABELS.split}
                </SelectItem>
              </SelectPopup>
            </Select>
          }
        />

        <SettingsRow
          {...searchableSetting("proactive-panels")}
          description={t("settingsC.proactivePanelsNote")}
          resetAction={
            settings.proactivePanelsEnabled !== DEFAULT_UNIFIED_SETTINGS.proactivePanelsEnabled ? (
              <SettingResetButton
                label={t("settingsC.labelProactivePanels")}
                onClick={() =>
                  updateSettings({
                    proactivePanelsEnabled: DEFAULT_UNIFIED_SETTINGS.proactivePanelsEnabled,
                  })
                }
              />
            ) : null
          }
          control={
            <Switch
              checked={settings.proactivePanelsEnabled}
              onCheckedChange={(checked) =>
                updateSettings({ proactivePanelsEnabled: Boolean(checked) })
              }
              aria-label={t("settingsC.proactivePanels")}
            />
          }
        />

        <SettingsRow
          {...searchableSetting("skills-in-slash-menu")}
          description={t("settingsC.includeSkills")}
          resetAction={
            settings.showSkillsInSlashMenu !== DEFAULT_UNIFIED_SETTINGS.showSkillsInSlashMenu ? (
              <SettingResetButton
                label={t("settingsC.labelSkillsInSlash")}
                onClick={() =>
                  updateSettings({
                    showSkillsInSlashMenu: DEFAULT_UNIFIED_SETTINGS.showSkillsInSlashMenu,
                  })
                }
              />
            ) : null
          }
          control={
            <Switch
              checked={settings.showSkillsInSlashMenu}
              onCheckedChange={(checked) =>
                updateSettings({ showSkillsInSlashMenu: Boolean(checked) })
              }
              aria-label={t("settingsC.showSkillsInSlash")}
            />
          }
        />

        <SettingsRow
          {...searchableSetting("composer-rich-text")}
          description={t("settingsC.showFormattedMarkdown")}
          resetAction={
            settings.composerRichTextEnabled !==
            DEFAULT_UNIFIED_SETTINGS.composerRichTextEnabled ? (
              <SettingResetButton
                label={t("settingsC.labelRichTextComposer")}
                onClick={() =>
                  updateSettings({
                    composerRichTextEnabled: DEFAULT_UNIFIED_SETTINGS.composerRichTextEnabled,
                  })
                }
              />
            ) : null
          }
          control={
            <Switch
              checked={settings.composerRichTextEnabled}
              onCheckedChange={(checked) =>
                updateSettings({ composerRichTextEnabled: Boolean(checked) })
              }
              aria-label={t("settingsC.richTextComposer")}
            />
          }
        />

        <SettingsRow
          {...searchableSetting("composer-collapse")}
          description={t("settingsC.collapseComposerNote")}
          resetAction={
            settings.composerCollapseOnScroll !==
            DEFAULT_UNIFIED_SETTINGS.composerCollapseOnScroll ? (
              <SettingResetButton
                label={t("settingsC.labelCollapseComposer")}
                onClick={() =>
                  updateSettings({
                    composerCollapseOnScroll: DEFAULT_UNIFIED_SETTINGS.composerCollapseOnScroll,
                  })
                }
              />
            ) : null
          }
          control={
            <Switch
              checked={settings.composerCollapseOnScroll}
              onCheckedChange={(checked) =>
                updateSettings({ composerCollapseOnScroll: Boolean(checked) })
              }
              aria-label={t("settingsC.collapseComposerOnScroll")}
            />
          }
        />

        <SettingsRow
          {...searchableSetting("send-shortcut")}
          description={t("settingsC.chooseEnterBehavior")}
          resetAction={
            settings.sendShortcut !== DEFAULT_UNIFIED_SETTINGS.sendShortcut ? (
              <SettingResetButton
                label={t("settingsC.labelSendShortcut")}
                onClick={() =>
                  updateSettings({ sendShortcut: DEFAULT_UNIFIED_SETTINGS.sendShortcut })
                }
              />
            ) : null
          }
          control={
            <Select
              value={settings.sendShortcut}
              onValueChange={(value) => {
                const option = sendShortcutOptions.find((option) => option.value === value);
                if (option) updateSettings({ sendShortcut: option.value });
              }}
            >
              <SelectTrigger
                size="sm"
                className="w-auto min-w-0 max-w-full"
                aria-label={t("settingsC.sendShortcut")}
              >
                <SelectValue>
                  {
                    sendShortcutOptions.find((option) => option.value === settings.sendShortcut)
                      ?.label
                  }
                </SelectValue>
              </SelectTrigger>
              <SelectPopup align="end" alignItemWithTrigger={false}>
                {sendShortcutOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    <span className="flex items-center justify-between gap-4">
                      {option.label}
                      {settings.sendShortcut === option.value && <CheckIcon aria-hidden="true" />}
                    </span>
                  </SelectItem>
                ))}
              </SelectPopup>
            </Select>
          }
        />

        <SettingsRow
          {...searchableSetting("follow-up-behavior")}
          description={
            "Queue follow-ups while the agent runs or steer the current run. " +
            (settings.sendShortcut === "mod-enter-multiline"
              ? `Press ${modifierLabel} + Enter for single-line prompts or ${modifierLabel} + Shift + Enter for multiline prompts to do the opposite for one message.`
              : `Press ${modifierLabel}${settings.sendShortcut === "mod-enter" ? " + Shift" : ""} + Enter to do the opposite for one message.`)
          }
          resetAction={
            settings.followUpBehavior !== DEFAULT_UNIFIED_SETTINGS.followUpBehavior ? (
              <SettingResetButton
                label={t("settingsC.labelFollowUpBehavior")}
                onClick={() =>
                  updateSettings({
                    followUpBehavior: DEFAULT_UNIFIED_SETTINGS.followUpBehavior,
                  })
                }
              />
            ) : null
          }
          control={
            <Select
              value={settings.followUpBehavior}
              onValueChange={(value) => {
                if (value === "queue" || value === "steer") {
                  updateSettings({ followUpBehavior: value });
                }
              }}
            >
              <SelectTrigger
                size="sm"
                className="w-auto min-w-0"
                aria-label={t("settingsC.followUpBehavior")}
              >
                <SelectValue>
                  {settings.followUpBehavior === "queue"
                    ? t("settingsC.queue")
                    : t("settingsC.steer")}
                </SelectValue>
              </SelectTrigger>
              <SelectPopup align="end" alignItemWithTrigger={false}>
                <SelectItem value="queue">{t("settingsC.queue")}</SelectItem>
                <SelectItem value="steer">{t("settingsC.steer")}</SelectItem>
              </SelectPopup>
            </Select>
          }
        />

        <SettingsRow
          serverScoped
          settingKeys={["enableProviderUpdateChecks"]}
          {...searchableSetting("provider-update-checks")}
          description={t("settingsC.checkProviderCli")}
          resetAction={
            settings.enableProviderUpdateChecks !==
            DEFAULT_UNIFIED_SETTINGS.enableProviderUpdateChecks ? (
              <SettingResetButton
                label={t("settingsC.labelProviderUpdateChecks")}
                onClick={() =>
                  updateSettings({
                    enableProviderUpdateChecks: DEFAULT_UNIFIED_SETTINGS.enableProviderUpdateChecks,
                  })
                }
              />
            ) : null
          }
          control={
            <ScopedSwitch
              settingKeys={["enableProviderUpdateChecks"]}
              checked={settings.enableProviderUpdateChecks}
              onCheckedChange={(checked) =>
                updateSettings({ enableProviderUpdateChecks: Boolean(checked) })
              }
              aria-label={t("settingsC.checkProviderVersions")}
            />
          }
        />

        <SettingsRow
          {...searchableSetting("continue-threads-after-server-update")}
          serverScoped
          settingKeys={["continueThreadsAfterServerUpdate"]}
          description={t("settingsC.autoResumeInterrupted")}
          status={
            !supportsRestartContinuation
              ? currentTranslator()("settingsC.restartContinuationNote")
              : undefined
          }
          resetAction={
            supportsRestartContinuation &&
            settings.continueThreadsAfterServerUpdate !==
              DEFAULT_UNIFIED_SETTINGS.continueThreadsAfterServerUpdate ? (
              <SettingResetButton
                label={t("settingsC.labelContinueAfterRestarts")}
                onClick={() =>
                  updateSettings({
                    continueThreadsAfterServerUpdate:
                      DEFAULT_UNIFIED_SETTINGS.continueThreadsAfterServerUpdate,
                  })
                }
              />
            ) : null
          }
          control={
            <ScopedSwitch
              settingKeys={["continueThreadsAfterServerUpdate"]}
              checked={settings.continueThreadsAfterServerUpdate}
              disabled={!supportsRestartContinuation}
              onCheckedChange={(checked) =>
                updateSettings({ continueThreadsAfterServerUpdate: Boolean(checked) })
              }
              aria-label={t("settingsC.continueAfterRestarts")}
            />
          }
        />

        <BackgroundActivitySettingsRow />
      </SettingsSection>

      <SettingsSection id="projects-and-threads" title={t("settingsC.projectsAndThreads")}>
        <SettingsRow
          serverScoped
          settingKeys={["newWorktreesStartFromOrigin"]}
          {...searchableSetting("start-from-origin")}
          description={t("settingsC.worktreeFromOrigin")}
          resetAction={
            settings.newWorktreesStartFromOrigin !==
            DEFAULT_UNIFIED_SETTINGS.newWorktreesStartFromOrigin ? (
              <SettingResetButton
                label={t("settingsC.labelWorktreesFromOrigin")}
                onClick={() =>
                  updateSettings({
                    newWorktreesStartFromOrigin:
                      DEFAULT_UNIFIED_SETTINGS.newWorktreesStartFromOrigin,
                  })
                }
              />
            ) : null
          }
          control={
            <ScopedSwitch
              settingKeys={["newWorktreesStartFromOrigin"]}
              checked={settings.newWorktreesStartFromOrigin}
              onCheckedChange={(checked) =>
                updateSettings({ newWorktreesStartFromOrigin: Boolean(checked) })
              }
              aria-label={t("settingsC.startWorktreesFromOrigin")}
            />
          }
        />
        <SettingsRow
          serverScoped
          settingKeys={["addProjectBaseDirectory"]}
          {...searchableSetting("add-project-starts-in")}
          description={t("settingsC.leaveEmptyHomeDir")}
          resetAction={
            settings.addProjectBaseDirectory !==
            DEFAULT_UNIFIED_SETTINGS.addProjectBaseDirectory ? (
              <SettingResetButton
                label={t("settingsC.labelProjectBaseDir")}
                onClick={() =>
                  updateSettings({
                    addProjectBaseDirectory: DEFAULT_UNIFIED_SETTINGS.addProjectBaseDirectory,
                  })
                }
              />
            ) : null
          }
          control={
            <DraftInput
              size="sm"
              className="w-full sm:w-72"
              value={mixedAddProjectBaseDirectory ? "" : settings.addProjectBaseDirectory}
              onCommit={(next) => updateSettings({ addProjectBaseDirectory: next })}
              placeholder={mixedAddProjectBaseDirectory ? t("settingsC.mixed") : "~/"}
              spellCheck={false}
              aria-label={t("settingsC.addProjectBaseDir")}
            />
          }
        />
      </SettingsSection>

      <SettingsSection id="confirmations" title={t("settingsC.confirmations")}>
        <SettingsRow
          {...searchableSetting("unpin-confirmation")}
          description={t("settingsC.askBeforeUnpin")}
          resetAction={
            settings.confirmThreadUnpin !== DEFAULT_UNIFIED_SETTINGS.confirmThreadUnpin ? (
              <SettingResetButton
                label={t("settingsC.labelUnpinConfirmation")}
                onClick={() =>
                  updateSettings({
                    confirmThreadUnpin: DEFAULT_UNIFIED_SETTINGS.confirmThreadUnpin,
                  })
                }
              />
            ) : null
          }
          control={
            <Switch
              checked={settings.confirmThreadUnpin}
              onCheckedChange={(checked) =>
                updateSettings({ confirmThreadUnpin: Boolean(checked) })
              }
              aria-label={t("settingsC.confirmUnpin")}
            />
          }
        />

        <SettingsRow
          {...searchableSetting("archive-confirmation")}
          description={t("settingsC.requireSecondClick")}
          resetAction={
            settings.confirmThreadArchive !== DEFAULT_UNIFIED_SETTINGS.confirmThreadArchive ? (
              <SettingResetButton
                label={t("settingsC.labelArchiveConfirmation")}
                onClick={() =>
                  updateSettings({
                    confirmThreadArchive: DEFAULT_UNIFIED_SETTINGS.confirmThreadArchive,
                  })
                }
              />
            ) : null
          }
          control={
            <Switch
              checked={settings.confirmThreadArchive}
              onCheckedChange={(checked) =>
                updateSettings({ confirmThreadArchive: Boolean(checked) })
              }
              aria-label={t("settingsC.confirmArchive")}
            />
          }
        />

        <SettingsRow
          {...searchableSetting("delete-confirmation")}
          description={t("settingsC.askBeforeDelete")}
          resetAction={
            settings.confirmThreadDelete !== DEFAULT_UNIFIED_SETTINGS.confirmThreadDelete ? (
              <SettingResetButton
                label={t("settingsC.labelDeleteConfirmation")}
                onClick={() =>
                  updateSettings({
                    confirmThreadDelete: DEFAULT_UNIFIED_SETTINGS.confirmThreadDelete,
                  })
                }
              />
            ) : null
          }
          control={
            <Switch
              checked={settings.confirmThreadDelete}
              onCheckedChange={(checked) =>
                updateSettings({ confirmThreadDelete: Boolean(checked) })
              }
              aria-label={t("settingsC.confirmDelete")}
            />
          }
        />

        {isElectron ? (
          <SettingsRow
            {...searchableSetting("quit-confirmation")}
            description={t("settingsC.holdModeQuits")}
            resetAction={
              settings.confirmQuit !== DEFAULT_UNIFIED_SETTINGS.confirmQuit ? (
                <SettingResetButton
                  label={t("settingsC.labelQuitShortcut")}
                  onClick={() =>
                    updateSettings({ confirmQuit: DEFAULT_UNIFIED_SETTINGS.confirmQuit })
                  }
                />
              ) : null
            }
            control={
              <Select
                value={settings.confirmQuit}
                onValueChange={(value) => {
                  if (value === "direct" || value === "hold" || value === "double-click") {
                    updateSettings({ confirmQuit: value });
                  }
                }}
              >
                <SelectTrigger
                  size="sm"
                  className="w-full sm:w-40"
                  aria-label={t("settingsC.quitShortcutBehavior")}
                >
                  <SelectValue>{QUIT_CONFIRMATION_MODE_LABELS[settings.confirmQuit]}</SelectValue>
                </SelectTrigger>
                <SelectPopup align="end" alignItemWithTrigger={false}>
                  {Object.entries(QUIT_CONFIRMATION_MODE_LABELS).map(([value, label]) => (
                    <SelectItem hideIndicator key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectPopup>
              </Select>
            }
          />
        ) : null}
      </SettingsSection>

      <SettingsSection id="text-generation" title={t("settingsC.textGeneration")}>
        <SettingsRow
          serverScoped
          settingKeys={["textGenerationModelSelection"]}
          {...searchableSetting("text-generation-model")}
          description={t("settingsC.textGenerationNote")}
          resetAction={
            hasServerTargets && isTextGenerationModelDirty ? (
              <SettingResetButton
                label={t("settingsC.labelTextGenModel")}
                onClick={() =>
                  updateSettings({
                    textGenerationModelSelection:
                      DEFAULT_UNIFIED_SETTINGS.textGenerationModelSelection,
                  })
                }
              />
            ) : null
          }
          control={
            !hasServerTargets ? (
              <span className="text-sm text-muted-foreground">
                {t("settingsC.connectForTextGen")}
              </span>
            ) : !hasTextGenerationProvider ? (
              <span className="text-sm text-muted-foreground">
                {t("settingsC.noTextGenProviders")}
              </span>
            ) : (
              <div className="flex flex-wrap items-center justify-end gap-1.5">
                <ProviderModelPicker
                  environmentId={environmentId}
                  activeInstanceId={textGenInstanceId}
                  model={textGenModel}
                  lockedProvider={null}
                  instanceEntries={textGenerationModelInstanceEntries}
                  modelOptionsByInstance={textGenerationModelOptionsByInstance}
                  triggerClassName={SETTINGS_PICKER_TRIGGER_CLASSNAME}
                  {...(mixedTextGenerationModel
                    ? { triggerLabel: currentTranslator()("settingsC.mixed") }
                    : {})}
                  getModelDisabledReason={textGenerationModelDisabledReason}
                  {...(environmentId
                    ? {
                        onOpenProviderSetup: (instanceId: ProviderInstanceId) => {
                          void navigate({
                            to: "/settings/providers",
                            search: { environmentId, instanceId },
                          });
                        },
                      }
                    : {})}
                  onInstanceModelChange={(instanceId, model) => {
                    const reason = textGenerationModelDisabledReason(instanceId, model);
                    if (reason) {
                      toastManager.add({
                        type: "error",
                        title: t("settingsC.textGenModelNotSaved"),
                        description: reason,
                      });
                      return;
                    }
                    updateSettings({
                      textGenerationModelSelection: resolveAppModelSelectionState(
                        {
                          ...settings,
                          textGenerationModelSelection: createModelSelection(instanceId, model),
                        },
                        textGenerationProviders,
                      ),
                    });
                  }}
                />
                {textGenInstanceEntry ? (
                  <TraitsPicker
                    provider={textGenProvider}
                    models={textGenInstanceEntry?.models ?? []}
                    model={textGenModel}
                    modelOptions={textGenModelOptions}
                    allowPromptInjectedEffort={false}
                    planModeEnabled={
                      settings.planModeEnabled || selectsPlanAgent(textGenModelOptions)
                    }
                    triggerClassName={SETTINGS_PICKER_TRIGGER_CLASSNAME}
                    onModelOptionsChange={(nextOptions) => {
                      updateSettings({
                        textGenerationModelSelection: resolveAppModelSelectionState(
                          {
                            ...settings,
                            textGenerationModelSelection: createModelSelection(
                              textGenInstanceId,
                              textGenModel,
                              nextOptions,
                            ),
                          },
                          textGenerationProviders,
                        ),
                      });
                    }}
                  />
                ) : null}
              </div>
            )
          }
        />
        <ThreadTitleInstructionsSettings />
      </SettingsSection>

      <SettingsSection id="about" title={t("settingsC.about")}>
        {isElectron || HOSTED_APP_CHANNEL ? (
          <AboutVersionSection />
        ) : (
          <>
            <SettingsRow
              id={searchableSetting("app-version").id}
              title={<AboutVersionTitle />}
              description={t("settingsC.currentVersion")}
            />
          </>
        )}
        <MobileAppSettingsRow />
        <SettingsRow
          {...searchableSetting("privacy-policy")}
          description={t("settingsC.privacyNote")}
          control={
            <Button
              render={<a href={PRIVACY_POLICY_URL} target="_blank" rel="noreferrer noopener" />}
              size="sm"
              variant="outline"
            >
              {t("settingsC.viewPolicy")}
            </Button>
          }
        />
      </SettingsSection>
      <SettingsSection title={t("settingsC.diagnostics")}>
        <SettingsRow
          {...searchableSetting("diagnostics")}
          description={
            isEnvironmentScope ? t("settingsC.inspectDiagnostics") : t("settingsC.inspectOneEnv")
          }
          control={
            <Button
              render={
                <Link to="/settings/diagnostics" search={{ machine: environmentId ?? undefined }} />
              }
              size="sm"
              variant="outline"
            >
              {t("settingsC.viewDiagnostics")}
            </Button>
          }
        />
        <SettingsRow
          {...searchableSetting("open-source-licenses")}
          description={t("settingsC.licenseNotices")}
          control={
            <Button
              render={<Link to="/settings/open-source-licenses" />}
              size="sm"
              variant="outline"
            >
              {t("settingsC.viewLicenses")}
            </Button>
          }
        />
      </SettingsSection>

      <LegacyFeaturesSection />
    </SettingsPageContainer>
  );
}
