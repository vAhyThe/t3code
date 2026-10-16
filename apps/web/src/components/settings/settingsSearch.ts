import { HOSTED_APP_CHANNEL } from "~/branding";
import { isElectron } from "~/env";
import { isMacPlatform, isWindowsPlatform, normalizeSearchText } from "~/lib/utils";
import { STATIC_KEYBINDING_COMMANDS, type KeybindingCommand } from "@t3tools/contracts";
import type { EnvironmentId } from "@t3tools/contracts";
import type { EnvironmentConnectionPhase } from "@t3tools/client-runtime/connection";
import { createTranslator, type MessageKey, type Translate } from "@t3tools/client-runtime/i18n";
import { sourceControlClients } from "@t3tools/client-runtime/source-control-clients";
import { DEFAULT_KEYBINDINGS } from "@t3tools/shared/keybindings";
import { searchLabels } from "~/i18n/searchLabels";
import { commandLabel } from "./KeybindingsSettings.logic";
import {
  validateSettingsScopeSearch,
  type ResolvedSettingsScope,
  type SettingsScopeSearch,
} from "./settingsScope";

export type SettingsPath =
  | "/settings/projects"
  | "/settings/general"
  | "/settings/diagnostics"
  | "/settings/appearance"
  | "/settings/keybindings"
  | "/settings/snap-shot"
  | "/settings/providers"
  | "/settings/integrations"
  | "/settings/scheduled-tasks"
  | "/settings/source-control"
  | "/settings/storage"
  | "/settings/connections"
  | "/settings/archived";

/**
 * Where a setting can be edited. Device-local rows have no scope: they render
 * at every selection. `project-defaults` rows accept project overrides, so
 * they are reachable from any server-backed selection.
 */
export type SettingsSearchScope =
  | "environment"
  | "environment-defaults"
  | "project-defaults"
  | "project"
  | "checkout"
  | "connections";

export interface SettingsSearchItem {
  readonly id: string;
  readonly title: string;
  /** Catalog key of the title once it is translated; `title` stays the English source. */
  readonly titleKey?: MessageKey;
  readonly to: SettingsPath;
  readonly targetId?: string;
  /** Descriptions, option labels, and aliases people may remember instead of the title. */
  readonly searchTerms?: ReadonlyArray<string>;
  readonly scope?: SettingsSearchScope;
  // Its row only renders in the desktop app, so a browser result would land on
  // an anchor that isn't there.
  readonly desktopOnly?: boolean;
  readonly macOnly?: boolean;
  // Its row only renders on Windows desktop, so other desktop platforms must
  // not expose a result that points to a missing anchor.
  readonly windowsOnly?: boolean;
  // Its row renders only where the release channel can change: the desktop
  // app, or a hosted web build deployed with a channel.
  readonly releaseChannelOnly?: boolean;
  readonly cloudOnly?: boolean;
  readonly environmentOnly?: boolean;
  readonly providerSettingsOnly?: boolean;
  readonly macProviderSettingsOnly?: boolean;
  readonly localBackendManagementOnly?: boolean;
  readonly localEnvironmentOnly?: boolean;
  readonly wslAvailableOnly?: boolean;
  // Its row only renders while this environment's T3 Connect managed tunnel is on.
  readonly managedTunnelOnly?: boolean;
  /**
   * Sorts after every other match. Keybinding commands mirror rows on other
   * surfaces, so "model" must still lead with Default model, not Model Picker.
   */
  readonly secondary?: boolean;
  readonly requiresThreadAutoSettlement?: boolean;
}

export interface SettingsSearchAvailability {
  readonly localEnvironmentDisabled?: boolean;
  readonly hasCloudPublicConfig: boolean;
  readonly hasEnvironment: boolean;
  readonly hasProviderSettingsEnvironment: boolean;
  readonly hasMacProviderSettingsEnvironment: boolean;
  readonly canManageLocalBackend: boolean;
  readonly isWslSettingsRowVisible: boolean;
  readonly hasThreadAutoSettlement: boolean;
  readonly managedTunnelActive?: boolean;
}

/**
 * Section labels in sidebar order. The sidebar nav and the search-result
 * subtitles both render from this record, so each label exists once.
 */
export const SETTINGS_SECTION_LABELS: Readonly<Record<SettingsPath, string>> = {
  "/settings/diagnostics": "Diagnostics",
  "/settings/projects": "Project",
  "/settings/general": "General",
  "/settings/appearance": "Appearance",
  "/settings/keybindings": "Keybindings",
  "/settings/snap-shot": "SnapShots",
  "/settings/providers": "Providers",
  "/settings/integrations": "Integrations",
  "/settings/scheduled-tasks": "Scheduled Tasks",
  "/settings/source-control": "Source Control",
  "/settings/storage": "Storage",
  "/settings/connections": "Connections",
  "/settings/archived": "Archive",
};

/** Anchor id of the first row bound to `command` on the Keybindings page. */
export function keybindingSearchAnchorId<Command extends KeybindingCommand>(command: Command) {
  return `keybinding-${command}` as const;
}

/**
 * One result per built-in command, alphabetical by label. The anchor is
 * the command's first row; default keys are searchable so "mod+b" lands on
 * Sidebar: Toggle. A command with no default binding may have no row, so it
 * points at the section instead.
 */
const KEYBINDING_SEARCH_ITEMS = STATIC_KEYBINDING_COMMANDS.toSorted((left, right) =>
  commandLabel(left).localeCompare(commandLabel(right)),
).map((command) => {
  const defaultKeys = DEFAULT_KEYBINDINGS.filter((binding) => binding.command === command).map(
    (binding) => binding.key,
  );
  return {
    id: keybindingSearchAnchorId(command),
    title: commandLabel(command),
    to: "/settings/keybindings" as const,
    searchTerms: [command, ...defaultKeys],
    secondary: true,
    ...(defaultKeys.length === 0 ? { targetId: "keybindings" } : {}),
  };
});

/** Anchor id of a source control host's settings form on the Source Control page. */
export function sourceControlHostSettingsSearchId(kind: string) {
  return `source-control-host-${kind}` as const;
}

/** One result per host whose definition declares settings, searchable by its field titles. */
const SOURCE_CONTROL_HOST_SEARCH_ITEMS = sourceControlClients.definitions.flatMap((definition) =>
  definition.settings && definition.kind !== "github"
    ? [
        {
          id: sourceControlHostSettingsSearchId(definition.kind),
          // i18n-ignore: dynamic host name, titleKey cannot take the label parameter
          title: `${definition.label} credentials`,
          to: "/settings/source-control" as const,
          searchTerms: [
            `${definition.label} ${Object.keys(definition.settings.fields).join(" ")} token credentials sign in`,
          ],
          environmentOnly: true,
          scope: "environment-defaults" as const,
        },
      ]
    : [],
);

/**
 * Searchable settings and stable destinations, in result order. Rows with a
 * dedicated anchor render their id and title via `searchableSetting`; items
 * that may not be mounted point at their nearest stable section instead.
 */
export const SETTINGS_SEARCH_ITEMS = [
  {
    id: "storage-worktree-keep-when",
    targetId: "storage-worktrees",
    // i18n-ignore: English search source, shown through titleKey
    title: "Keep worktrees with local changes",
    titleKey: "settingsD.searchStorageWorktreeKeepWhen",
    to: "/settings/storage",
    scope: "project-defaults",
    searchTerms: [
      "any local files uncommitted changes edited tracked files ignored env build output cleanup",
    ],
  },
  {
    id: "storage-delete-now",
    // i18n-ignore: English search source, shown through titleKey
    title: "Delete now",
    titleKey: "settingsD.searchStorageDeleteNow",
    to: "/settings/storage",
    scope: "environment-defaults",
    searchTerms: ["storage cleanup run now results report removed kept failed"],
  },
  {
    id: "storage-worktrees",
    // i18n-ignore: English search source, shown through titleKey
    title: "Worktree cleanup",
    titleKey: "settingsD.searchStorageWorktrees",
    to: "/settings/storage",
    scope: "project-defaults",
    searchTerms: [
      "disk storage delete deleted archived threads old inactive merged unchanged worktrees retention days project inherit off custom",
    ],
  },
  {
    id: "storage-worktrees-location",
    // i18n-ignore: English search source, shown through titleKey
    title: "Worktree location",
    titleKey: "settingsD.searchStorageWorktreesLocation",
    to: "/settings/storage",
    scope: "environment-defaults",
    searchTerms: ["worktree location folder directory path drive external disk"],
  },
  {
    id: "storage-artifacts",
    // i18n-ignore: English search source, shown through titleKey
    title: "Artifacts and logs",
    titleKey: "settingsD.searchStorageArtifacts",
    to: "/settings/storage",
    scope: "environment-defaults",
    searchTerms: ["disk storage browser screenshots captures rotated logs cleanup retention"],
  },
  {
    id: "project-defaults",
    // i18n-ignore: English search source, shown through titleKey
    title: "Project defaults and overrides",
    titleKey: "settingsD.searchProjectDefaults",
    to: "/settings/general",
    scope: "project-defaults",
    searchTerms: ["model workspace environments projects inheritance checkout"],
  },
  {
    id: "project-overview",
    // i18n-ignore: English search source, shown through titleKey
    title: "Project overview",
    titleKey: "settingsD.searchProjectOverview",
    to: "/settings/projects",
    searchTerms: ["name icon emoji image checkout remove delete"],
  },
  {
    id: "default-model",
    // i18n-ignore: English search source, shown through titleKey
    title: "Default model",
    titleKey: "settingsD.searchDefaultModel",
    to: "/settings/general",
    scope: "project-defaults",
    searchTerms: ["new thread project provider reasoning effort"],
  },
  {
    id: "default-permissions",
    // i18n-ignore: English search source, shown through titleKey
    title: "Permissions",
    titleKey: "settingsD.searchDefaultPermissions",
    to: "/settings/general",
    scope: "project-defaults",
    searchTerms: [
      "new thread default runtime mode supervised approvals auto accept edits full access",
    ],
  },
  {
    id: "color-scheme",
    // i18n-ignore: English search source, shown through titleKey
    title: "Color scheme",
    titleKey: "settingsD.searchColorScheme",
    to: "/settings/appearance",
    searchTerms: ["appearance light dark system mode"],
    // The scheme tiles sit at the top of the Appearance section.
    targetId: "appearance",
  },
  {
    id: "theme",
    // i18n-ignore: English search source, shown through titleKey
    title: "Themes",
    titleKey: "settingsD.searchTheme",
    to: "/settings/appearance",
    searchTerms: ["appearance colors palette custom import"],
    // Theme cards live directly under the scheme tiles; the section is the
    // stable scroll destination for both.
    targetId: "appearance",
  },
  {
    // Prefixed because the slider control already owns the `appearance-contrast` id.
    id: "setting-appearance-contrast",
    // i18n-ignore: English search source, shown through titleKey
    title: "Contrast",
    titleKey: "settingsD.searchSettingAppearanceContrast",
    to: "/settings/appearance",
    searchTerms: ["colors borders interface"],
  },
  {
    // Prefixed because the slider control already owns the `glass-opacity` id.
    id: "setting-glass-opacity",
    // i18n-ignore: English search source, shown through titleKey
    title: "Glass opacity",
    titleKey: "settingsD.searchSettingGlassOpacity",
    to: "/settings/appearance",
    searchTerms: ["transparent transparency solid menus dialogs composer"],
  },
  {
    id: "diff-color-scheme",
    // i18n-ignore: English search source, shown through titleKey
    title: "Diff colors",
    titleKey: "settingsD.searchDiffColorScheme",
    to: "/settings/appearance",
    searchTerms: ["red green blue orange additions deletions changes counts palette colorblind"],
  },
  {
    id: "chat-width",
    // i18n-ignore: English search source, shown through titleKey
    title: "Chat width",
    titleKey: "settingsD.searchChatWidth",
    to: "/settings/appearance",
    searchTerms: ["wide full width column layout messages composer monitor"],
  },
  {
    id: "panel-animations",
    // i18n-ignore: English search source, shown through titleKey
    title: "Panel animations",
    titleKey: "settingsD.searchPanelAnimations",
    to: "/settings/appearance",
  },
  {
    id: "environment-identification",
    // i18n-ignore: English search source, shown through titleKey
    title: "Environment identification",
    titleKey: "settingsD.searchEnvironmentIdentification",
    to: "/settings/appearance",
    searchTerms: ["dev nightly artwork pill label hide none"],
    // The setting is stage-dependent, so its parent section is the stable destination.
    targetId: "appearance-interface",
  },
  {
    id: "interface-font",
    // i18n-ignore: English search source, shown through titleKey
    title: "Interface font",
    titleKey: "settingsD.searchInterfaceFont",
    to: "/settings/appearance",
    searchTerms: ["typography family size system sans"],
  },
  {
    id: "prompt-font",
    // i18n-ignore: English search source, shown through titleKey
    title: "Prompt font",
    titleKey: "settingsD.searchPromptFont",
    to: "/settings/appearance",
    searchTerms: ["typography family size composer input"],
  },
  {
    id: "code-font",
    // i18n-ignore: English search source, shown through titleKey
    title: "Code font",
    titleKey: "settingsD.searchCodeFont",
    to: "/settings/appearance",
    searchTerms: ["typography family size monospace code blocks diffs file previews"],
  },
  {
    id: "terminal-font",
    // i18n-ignore: English search source, shown through titleKey
    title: "Terminal font",
    titleKey: "settingsD.searchTerminalFont",
    to: "/settings/appearance",
    searchTerms: ["typography family size monospace output"],
  },
  {
    id: "font-smoothing",
    // i18n-ignore: English search source, shown through titleKey
    title: "Font smoothing",
    titleKey: "settingsD.searchFontSmoothing",
    to: "/settings/appearance",
    searchTerms: ["typography text grayscale anti aliasing macos thin"],
    macOnly: true,
  },
  {
    id: "word-wrap",
    // i18n-ignore: English search source, shown through titleKey
    title: "Word wrap",
    titleKey: "settingsD.searchWordWrap",
    to: "/settings/appearance",
    searchTerms: ["long lines code blocks tables diffs file previews"],
  },
  {
    id: "composer-context",
    // i18n-ignore: English search source, shown through titleKey
    title: "Composer context",
    titleKey: "settingsD.searchComposerContext",
    to: "/settings/appearance",
  },
  {
    id: "project-grouping",
    // i18n-ignore: English search source, shown through titleKey
    title: "Project grouping",
    titleKey: "settingsD.searchProjectGrouping",
    to: "/settings/general",
    searchTerms: ["combine matching repositories environments sidebar"],
  },
  {
    id: "project-order",
    // i18n-ignore: English search source, shown through titleKey
    title: "Project order",
    titleKey: "settingsD.searchProjectOrder",
    to: "/settings/general",
    searchTerms: ["sort projects sidebar manual created recent"],
  },
  {
    id: "snooze-limited-threads",
    // i18n-ignore: English search source, shown through titleKey
    title: "Snooze limited threads",
    titleKey: "settingsD.searchSnoozeLimitedThreads",
    to: "/settings/general",
    searchTerms: ["usage quota rate limit reset wake recover continue"],
  },
  {
    id: "auto-resume-limited-threads",
    // i18n-ignore: English search source, shown through titleKey
    title: "Auto-resume limited threads",
    titleKey: "settingsD.searchAutoResumeLimitedThreads",
    to: "/settings/general",
    searchTerms: ["usage quota rate limit reset recover continue"],
  },
  {
    id: "working-shelf",
    // i18n-ignore: English search source, shown through titleKey
    title: "Working section (beta)",
    titleKey: "settingsD.searchWorkingShelf",
    to: "/settings/general",
    searchTerms: ["hide fold running monitoring threads inbox sidebar shelf"],
  },
  {
    id: "auto-settle-inactive-threads",
    // i18n-ignore: English search source, shown through titleKey
    title: "Auto-settle inactive threads",
    titleKey: "settingsD.searchAutoSettleInactiveThreads",
    to: "/settings/general",
    searchTerms: ["sidebar inactivity days no activity automatically"],
    requiresThreadAutoSettlement: true,
    scope: "project-defaults",
  },
  {
    id: "auto-settle-merged-threads",
    // i18n-ignore: English search source, shown through titleKey
    title: "Auto-settle merged threads",
    titleKey: "settingsD.searchAutoSettleMergedThreads",
    to: "/settings/general",
    searchTerms: ["pull request merge closed automatically sidebar"],
    requiresThreadAutoSettlement: true,
    scope: "project-defaults",
  },
  {
    id: "days-before-auto-settle",
    // i18n-ignore: English search source, shown through titleKey
    title: "Days of inactivity before auto-settle",
    titleKey: "settingsD.searchDaysBeforeAutoSettle",
    to: "/settings/general",
    targetId: "auto-settle-inactive-threads",
    searchTerms: ["thread timeout activity sidebar"],
    requiresThreadAutoSettlement: true,
    scope: "project-defaults",
  },
  {
    id: "thread-notifications",
    // i18n-ignore: English search source, shown through titleKey
    title: "Thread notifications",
    titleKey: "settingsD.searchThreadNotifications",
    to: "/settings/general",
    searchTerms: ["notification sound alert completion input approval desktop"],
  },
  {
    id: "in-app-notifications",
    // i18n-ignore: English search source, shown through titleKey
    title: "In-app notifications",
    titleKey: "settingsD.searchInAppNotifications",
    to: "/settings/general",
    searchTerms: ["notification toast popup completion input approval failure"],
  },
  {
    id: "interface-language",
    // i18n-ignore: English search source, shown through titleKey
    title: "Language",
    titleKey: "settingsA.language",
    to: "/settings/general",
    searchTerms: ["interface locale translation english czech cestina jazyk"],
  },
  {
    id: "time-format",
    // i18n-ignore: English search source, shown through titleKey
    title: "Time format",
    titleKey: "settingsD.searchTimeFormat",
    to: "/settings/general",
    searchTerms: ["timestamp clock locale system browser os 12 hour 24 hour"],
  },
  {
    id: "response-streaming",
    // i18n-ignore: English search source, shown through titleKey
    title: "Response streaming",
    titleKey: "settingsD.searchResponseStreaming",
    to: "/settings/general",
    scope: "project-defaults",
    searchTerms: ["output token paragraph buffered wait turn legacy"],
  },
  {
    id: "hide-whitespace-changes",
    // i18n-ignore: English search source, shown through titleKey
    title: "Hide whitespace changes",
    titleKey: "settingsD.searchHideWhitespaceChanges",
    to: "/settings/general",
    searchTerms: ["diff ignore spaces edits default"],
  },
  {
    id: "default-diff-file-state",
    // i18n-ignore: English search source, shown through titleKey
    title: "Default diff file state",
    titleKey: "settingsD.searchDefaultDiffFileState",
    to: "/settings/general",
    searchTerms: ["collapsed expanded collapse expand files pull request pr code tab"],
  },
  {
    id: "diff-layout",
    // i18n-ignore: English search source, shown through titleKey
    title: "Diff layout",
    titleKey: "settingsD.searchDiffLayout",
    to: "/settings/general",
    searchTerms: ["stacked split side by side unified inline view"],
  },
  {
    id: "proactive-panels",
    // i18n-ignore: English search source, shown through titleKey
    title: "Proactive panels",
    titleKey: "settingsD.searchProactivePanels",
    to: "/settings/general",
    searchTerms: ["automatically open diff pull request pr right panel agent completion"],
  },
  {
    id: "skills-in-slash-menu",
    // i18n-ignore: English search source, shown through titleKey
    title: "Show skills in slash menu",
    titleKey: "settingsD.searchSkillsInSlashMenu",
    to: "/settings/general",
    searchTerms: ["command menu dollar $ slash /"],
  },
  {
    id: "composer-rich-text",
    // i18n-ignore: English search source, shown through titleKey
    title: "Rich text composer",
    titleKey: "settingsD.searchComposerRichText",
    to: "/settings/general",
    searchTerms: ["composer rich text tiptap bold italic markdown styled wysiwyg"],
  },
  {
    id: "composer-collapse",
    // i18n-ignore: English search source, shown through titleKey
    title: "Collapse composer on scroll",
    titleKey: "settingsD.searchComposerCollapse",
    to: "/settings/general",
    searchTerms: ["composer rest resting scroll wheel conversation timeline shrink minimize"],
  },
  {
    id: "send-shortcut",
    // i18n-ignore: English search source, shown through titleKey
    title: "Send shortcut",
    titleKey: "settingsD.searchSendShortcut",
    to: "/settings/general",
    searchTerms: ["enter return command ctrl multiline prompt new line composer"],
  },
  {
    id: "follow-up-behavior",
    // i18n-ignore: English search source, shown through titleKey
    title: "Follow-up behavior",
    titleKey: "settingsD.searchFollowUpBehavior",
    to: "/settings/general",
    searchTerms: ["queue steer running turn send default behavior composer"],
  },
  {
    id: "provider-update-checks",
    // i18n-ignore: English search source, shown through titleKey
    title: "Provider update checks",
    titleKey: "settingsD.searchProviderUpdateChecks",
    to: "/settings/general",
    searchTerms: ["installed cli versions newer available codex claude cursor grok opencode"],
    scope: "environment-defaults",
  },
  {
    id: "continue-threads-after-server-update",
    // i18n-ignore: English search source, shown through titleKey
    title: "Continue threads after restarts",
    titleKey: "settingsD.searchContinueThreadsAfterServerUpdate",
    to: "/settings/general",
    scope: "project-defaults",
    searchTerms: [
      "resume running active interrupted work restart reboot machine crash desktop update automatically",
    ],
  },
  {
    id: "background-activity",
    // i18n-ignore: English search source, shown through titleKey
    title: "Background activity",
    titleKey: "settingsD.searchBackgroundActivity",
    to: "/settings/general",
    scope: "environment-defaults",
    searchTerms: [
      "balanced performance battery saver advanced git fetch provider health refresh host power monitor idle policy",
    ],
  },
  {
    id: "new-threads",
    // i18n-ignore: English search source, shown through titleKey
    title: "New threads",
    titleKey: "settingsD.searchNewThreads",
    to: "/settings/general",
    scope: "project-defaults",
    searchTerms: ["default workspace mode draft local worktree"],
  },
  {
    id: "worktree-submodules",
    // i18n-ignore: English search source, shown through titleKey
    title: "Submodules",
    titleKey: "settingsD.searchWorktreeSubmodules",
    to: "/settings/general",
    scope: "project-defaults",
    searchTerms: ["git submodule init recursive top-level none worktree t3.json"],
  },
  {
    id: "start-from-origin",
    // i18n-ignore: English search source, shown through titleKey
    title: "Start from origin",
    titleKey: "settingsD.searchStartFromOrigin",
    to: "/settings/general",
    scope: "project-defaults",
    searchTerms: ["new worktrees latest matching remote branch local"],
  },
  {
    id: "add-project-starts-in",
    // i18n-ignore: English search source, shown through titleKey
    title: "Add project starts in",
    titleKey: "settingsD.searchAddProjectStartsIn",
    to: "/settings/general",
    scope: "environment-defaults",
    searchTerms: ["base directory folder browser path home"],
  },
  {
    id: "unpin-confirmation",
    // i18n-ignore: English search source, shown through titleKey
    title: "Unpin confirmation",
    titleKey: "settingsD.searchUnpinConfirmation",
    to: "/settings/general",
    searchTerms: ["ask before thread pinned section"],
  },
  {
    id: "archive-confirmation",
    // i18n-ignore: English search source, shown through titleKey
    title: "Archive confirmation",
    titleKey: "settingsD.searchArchiveConfirmation",
    to: "/settings/general",
    searchTerms: ["ask before thread second click inline action"],
  },
  {
    id: "delete-confirmation",
    // i18n-ignore: English search source, shown through titleKey
    title: "Delete confirmation",
    titleKey: "settingsD.searchDeleteConfirmation",
    to: "/settings/general",
    searchTerms: ["ask before thread chat history"],
  },
  {
    id: "quit-confirmation",
    // i18n-ignore: English search source, shown through titleKey
    title: "Quit shortcut",
    titleKey: "settingsD.searchQuitConfirmation",
    to: "/settings/general",
    searchTerms: ["confirmation desktop app exit direct hold double click press twice"],
    desktopOnly: true,
  },
  {
    id: "text-generation-model",
    // i18n-ignore: English search source, shown through titleKey
    title: "Text generation model",
    titleKey: "settingsD.searchTextGenerationModel",
    to: "/settings/general",
    scope: "project-defaults",
    searchTerms: ["generated thread titles source control content default provider"],
  },
  {
    id: "app-version",
    // i18n-ignore: English search source, shown through titleKey
    title: "Version",
    titleKey: "settingsD.searchAppVersion",
    to: "/settings/general",
    searchTerms: ["about check for updates download install upgrade release"],
  },
  {
    id: "update-track",
    // i18n-ignore: English search source, shown through titleKey
    title: "Update track",
    titleKey: "settingsD.searchUpdateTrack",
    to: "/settings/general",
    searchTerms: ["release channel stable latest nightly prerelease"],
    releaseChannelOnly: true,
  },
  {
    id: "cli-command",
    // i18n-ignore: English search source, shown through titleKey
    title: "t3 command",
    titleKey: "settingsD.searchCliCommand",
    to: "/settings/general",
    searchTerms: ["cli terminal shell path install command line"],
    desktopOnly: true,
  },
  {
    id: "privacy-policy",
    // i18n-ignore: English search source, shown through titleKey
    title: "Privacy policy",
    titleKey: "settingsD.searchPrivacyPolicy",
    to: "/settings/general",
    searchTerms: ["telemetry analytics usage data tracking legal opt out"],
  },
  {
    id: "telemetry-export",
    // i18n-ignore: English search source, shown through titleKey
    title: "OpenTelemetry export",
    titleKey: "settingsD.searchTelemetryExport",
    to: "/settings/diagnostics",
    targetId: "telemetry-export",
    scope: "environment",
    searchTerms: ["OTel OTLP telemetry export endpoints logs traces metrics Grafana"],
  },
  {
    id: "diagnostics",
    // i18n-ignore: English search source, shown through titleKey
    title: "Diagnostics",
    titleKey: "settingsD.searchDiagnostics",
    to: "/settings/general",
    searchTerms: ["logs traces processes resource history failures spans cpu memory"],
  },
  {
    id: "open-source-licenses",
    // i18n-ignore: English search source, shown through titleKey
    title: "Open source licenses",
    titleKey: "settingsD.searchOpenSourceLicenses",
    to: "/settings/general",
  },
  {
    id: "legacy-plan-mode",
    // i18n-ignore: English search source, shown through titleKey
    title: "Plan mode (legacy)",
    titleKey: "settingsD.searchLegacyPlanMode",
    to: "/settings/general",
    searchTerms: ["build plan composer old"],
  },
  {
    id: "legacy-context-window-indicator",
    // i18n-ignore: English search source, shown through titleKey
    title: "Context window indicator (legacy)",
    titleKey: "settingsD.searchLegacyContextWindowIndicator",
    to: "/settings/general",
    searchTerms: ["composer meter usage tokens circle old"],
  },
  {
    id: "legacy-sidebar",
    // i18n-ignore: English search source, shown through titleKey
    title: "Sidebar (legacy)",
    titleKey: "settingsD.searchLegacySidebar",
    to: "/settings/general",
    searchTerms: ["project thread tree old flat list"],
  },
  {
    id: "keybindings",
    // i18n-ignore: English search source, shown through titleKey
    title: "Keybindings",
    titleKey: "settingsB.keybindings",
    to: "/settings/keybindings",
    searchTerms: ["keyboard shortcuts hotkeys commands bindings json"],
  },
  ...KEYBINDING_SEARCH_ITEMS,
  {
    id: "snap-shot-enabled",
    // i18n-ignore: English search source, shown through titleKey
    title: "SnapShots",
    titleKey: "settingsD.searchSnapShotEnabled",
    searchTerms: ["window capture screenshot"],
    to: "/settings/snap-shot",
  },
  {
    id: "snap-shot-accessibility",
    // i18n-ignore: English search source, shown through titleKey
    title: "Include app text",
    titleKey: "settingsD.searchSnapShotAccessibility",
    to: "/settings/snap-shot",
    targetId: "snap-shot-enabled",
    searchTerms: [
      "capture accessibility data text UI structure elements privacy omit agent context",
    ],
  },
  {
    id: "snap-shot-shortcut",
    // i18n-ignore: English search source, shown through titleKey
    title: "Capture shortcut",
    titleKey: "settingsD.searchSnapShotShortcut",
    to: "/settings/snap-shot",
    targetId: "snap-shot-enabled",
  },
  {
    id: "snap-shot-sound",
    // i18n-ignore: English search source, shown through titleKey
    title: "Capture sound",
    titleKey: "settingsD.searchSnapShotSound",
    to: "/settings/snap-shot",
    targetId: "snap-shot-enabled",
  },
  {
    id: "snap-shot-flash",
    // i18n-ignore: English search source, shown through titleKey
    title: "Capture flash",
    titleKey: "settingsD.searchSnapShotFlash",
    to: "/settings/snap-shot",
    targetId: "snap-shot-enabled",
  },
  {
    id: "snap-shot-animations",
    // i18n-ignore: English search source, shown through titleKey
    title: "Capture animations",
    titleKey: "settingsD.searchSnapShotAnimations",
    to: "/settings/snap-shot",
    targetId: "snap-shot-enabled",
  },
  {
    id: "providers",
    // i18n-ignore: English search source, shown through titleKey
    title: "Providers",
    titleKey: "settingsD.searchProviders",
    to: "/settings/providers",
    searchTerms: [
      "agents cli codex claude cursor grok opencode antigravity google sign in sign out install subscription instances authentication api key models configuration binary path config directory endpoint arguments environment variables display name accent color custom favorite hidden auto compact",
    ],
  },
  {
    id: "usage-providers",
    // i18n-ignore: English search source, shown through titleKey
    title: "Usage providers",
    titleKey: "settingsD.searchUsageProviders",
    to: "/settings/providers",
    searchTerms: [
      "usage sources CLIProxyAPI CLI proxy hub quota subscription limits management key add remove",
    ],
    providerSettingsOnly: true,
  },
  {
    id: "cursor-keychain-usage",
    // i18n-ignore: English search source, shown through titleKey
    title: "Cursor account usage",
    titleKey: "settingsD.searchCursorKeychainUsage",
    to: "/settings/providers",
    searchTerms: ["cursor macOS keychain usage tokens cost limits permission"],
    providerSettingsOnly: true,
    macProviderSettingsOnly: true,
  },
  {
    id: "provider-health-check-interval",
    // i18n-ignore: English search source, shown through titleKey
    title: "Health check interval",
    titleKey: "settingsD.searchProviderHealthCheckInterval",
    to: "/settings/providers",
    searchTerms: ["refresh availability versions auth state models background probes seconds off"],
    providerSettingsOnly: true,
  },
  {
    id: "agent-browser-access",
    // i18n-ignore: English search source, shown through titleKey
    title: "Agent browser access",
    titleKey: "settingsD.searchAgentBrowserAccess",
    to: "/settings/integrations",
    scope: "project-defaults",
    searchTerms: ["allow disable enable open drive preview tools sessions project override"],
  },
  {
    id: "device-hosts",
    // i18n-ignore: English search source, shown through titleKey
    title: "Device hosts",
    titleKey: "settingsD.searchDeviceHosts",
    to: "/settings/integrations",
    searchTerms: ["ssh remote simulator emulator ios android mac mini identity key connection"],
  },
  {
    id: "agent-device-access",
    // i18n-ignore: English search source, shown through titleKey
    title: "Agent device access",
    titleKey: "settingsD.searchAgentDeviceAccess",
    to: "/settings/integrations",
    targetId: "devices",
    searchTerms: ["allow simulator emulator ios android drive tools sessions"],
  },
  {
    id: "device-hub",
    // i18n-ignore: English search source, shown through titleKey
    title: "Device hub",
    titleKey: "settingsD.searchDeviceHub",
    to: "/settings/integrations",
    targetId: "devices",
    searchTerms: ["simulator emulator ios android install start"],
  },
  {
    id: "device-platform-support",
    // i18n-ignore: English search source, shown through titleKey
    title: "Simulator support",
    titleKey: "settingsD.searchDevicePlatformSupport",
    to: "/settings/integrations",
    targetId: "devices",
    searchTerms: ["xcode android studio sdk avd runtime"],
  },
  {
    id: "browser-profiles",
    // i18n-ignore: English search source, shown through titleKey
    title: "Browser profiles",
    titleKey: "settingsD.searchBrowserProfiles",
    to: "/settings/integrations",
    targetId: "browser",
  },
  {
    id: "browser-default-profile",
    // i18n-ignore: English search source, shown through titleKey
    title: "Default browser profile",
    titleKey: "settingsD.searchBrowserDefaultProfile",
    to: "/settings/integrations",
    targetId: "browser-profiles",
  },
  {
    id: "browser-default-viewport",
    // i18n-ignore: English search source, shown through titleKey
    title: "Default browser viewport",
    titleKey: "settingsD.searchBrowserDefaultViewport",
    to: "/settings/integrations",
    searchTerms: ["preview size width height device desktop mobile rotate"],
  },
  {
    id: "browser-default-zoom",
    // i18n-ignore: English search source, shown through titleKey
    title: "Default browser zoom",
    titleKey: "settingsD.searchBrowserDefaultZoom",
    to: "/settings/integrations",
    searchTerms: ["preview page scale tabs percent"],
  },
  {
    id: "browser-default-appearance",
    // i18n-ignore: English search source, shown through titleKey
    title: "Default browser appearance",
    titleKey: "settingsD.searchBrowserDefaultAppearance",
    to: "/settings/integrations",
    searchTerms: ["preview color scheme light dark system os"],
  },
  {
    id: "browser-recording-frame-rate",
    // i18n-ignore: English search source, shown through titleKey
    title: "Browser recording frame rate",
    titleKey: "settingsD.searchBrowserRecordingFrameRate",
    to: "/settings/integrations",
  },
  {
    id: "browser-recording-key-presses",
    // i18n-ignore: English search source, shown through titleKey
    title: "Show key presses in recordings",
    titleKey: "settingsD.searchBrowserRecordingKeyPresses",
    to: "/settings/integrations",
    searchTerms: ["browser preview keyboard shortcuts keystrokes overlay capture"],
  },
  {
    id: "browser-recording-mouse-presses",
    // i18n-ignore: English search source, shown through titleKey
    title: "Show mouse presses in recordings",
    titleKey: "settingsD.searchBrowserRecordingMousePresses",
    to: "/settings/integrations",
    searchTerms: ["browser preview clicks buttons drag overlay capture"],
  },
  {
    id: "browser-link-target",
    // i18n-ignore: English search source, shown through titleKey
    title: "Open links in",
    titleKey: "settingsD.searchBrowserLinkTarget",
    to: "/settings/integrations",
    searchTerms: ["links default browser in-app browser external open"],
  },
  {
    id: "pull-request-links-open-in-app",
    // i18n-ignore: English search source, shown through titleKey
    title: "Open pull requests in T3 Code",
    titleKey: "settingsD.searchPullRequestLinksOpenInApp",
    to: "/settings/integrations",
    searchTerms: ["pr links github browser external click default pull request view panel"],
  },
  {
    id: "browser-auto-show-floating-preview",
    // i18n-ignore: English search source, shown through titleKey
    title: "Auto-show floating preview",
    titleKey: "settingsD.searchBrowserAutoShowFloatingPreview",
    to: "/settings/integrations",
    searchTerms: ["agent opens browser device simulator pop into view hide"],
  },
  {
    id: "automatic-pull",
    // i18n-ignore: English search source, shown through titleKey
    title: "Automatically pull",
    titleKey: "settingsD.searchAutomaticPull",
    to: "/settings/source-control",
    scope: "project-defaults",
    searchTerms: ["auto pull default branch current checkout fast forward upstream"],
  },
  {
    id: "remove-agent-credits-on-merge",
    // i18n-ignore: English search source, shown through titleKey
    title: "Remove agent credits when merging",
    titleKey: "settingsD.searchRemoveAgentCreditsOnMerge",
    to: "/settings/source-control",
    scope: "project-defaults",
    searchTerms: ["pull request github squash co-authored-by attribution claude codex generated"],
  },
  {
    id: "pull-request-merge-method",
    // i18n-ignore: English search source, shown through titleKey
    title: "Default merge method",
    titleKey: "settingsD.searchPullRequestMergeMethod",
    to: "/settings/source-control",
    scope: "project-defaults",
    searchTerms: ["pull request merge squash rebase last selected"],
  },
  {
    id: "source-control",
    // i18n-ignore: English search source, shown through titleKey
    title: "Source control",
    titleKey: "settingsD.searchSourceControl",
    to: "/settings/source-control",
    scope: "environment-defaults",
    searchTerms: [
      "version control git github gitlab forgejo gitea tea codeberg bitbucket azure devops hosting integrations credentials scan server environment",
    ],
  },
  {
    id: "git-fetch-interval",
    // i18n-ignore: English search source, shown through titleKey
    title: "Git fetch interval",
    titleKey: "settingsD.searchGitFetchInterval",
    to: "/settings/source-control",
    searchTerms: [
      "automatic remote branch refresh background credentials security keys seconds off",
    ],
    environmentOnly: true,
    scope: "environment-defaults",
  },
  {
    id: "worktree-branch-naming",
    // i18n-ignore: English search source, shown through titleKey
    title: "Worktree branch naming",
    titleKey: "settingsD.searchWorktreeBranchNaming",
    to: "/settings/source-control",
    searchTerms: ["static semantic prefix custom prompt instructions feat fix refactor chore"],
    environmentOnly: true,
    scope: "project-defaults",
  },
  {
    id: "github-accounts",
    // i18n-ignore: English search source, shown through titleKey
    title: "GitHub accounts and token",
    titleKey: "settingsD.searchGithubAccounts",
    to: "/settings/source-control",
    searchTerms: [
      "github gh account login user host enterprise ghes switch multiple accounts disable sign in token personal access token pat api key credential",
    ],
    environmentOnly: true,
    scope: "environment-defaults",
  },
  ...SOURCE_CONTROL_HOST_SEARCH_ITEMS,
  {
    id: "source-control-writing-style",
    // i18n-ignore: English search source, shown through titleKey
    title: "Source control writing style",
    titleKey: "settingsD.searchSourceControlWritingStyle",
    to: "/settings/source-control",
    searchTerms: [
      "repository conventions conventional commits custom instructions change descriptions request titles",
    ],
    environmentOnly: true,
  },
  {
    id: "follow-change-request-templates",
    // i18n-ignore: English search source, shown through titleKey
    title: "Follow change request templates",
    titleKey: "settingsD.searchFollowChangeRequestTemplates",
    to: "/settings/source-control",
    searchTerms: ["repository pr pull request description structure"],
    environmentOnly: true,
  },
  {
    id: "source-control-writer-model",
    // i18n-ignore: English search source, shown through titleKey
    title: "Source control writer model",
    titleKey: "settingsD.searchSourceControlWriterModel",
    to: "/settings/source-control",
    searchTerms: [
      "override generated commit change request pr titles descriptions branch bookmark",
    ],
    environmentOnly: true,
    scope: "project-defaults",
  },
  {
    id: "review-guides",
    // i18n-ignore: English search source, shown through titleKey
    title: "Review guides (beta)",
    titleKey: "settingsD.searchReviewGuides",
    to: "/settings/source-control",
    searchTerms: ["pull request pr guided review guide tour beta experimental"],
    environmentOnly: true,
  },
  {
    id: "review-guide-model",
    // i18n-ignore: English search source, shown through titleKey
    title: "Review guide model",
    titleKey: "settingsD.searchReviewGuideModel",
    to: "/settings/source-control",
    // Hidden until review guides are on, so a search lands on the switch that shows it.
    targetId: "review-guides",
    searchTerms: ["pull request pr guided review guide brief maintainer"],
    environmentOnly: true,
    scope: "project-defaults",
  },
  {
    id: "review-guide-instructions",
    // i18n-ignore: English search source, shown through titleKey
    title: "Review guide instructions",
    titleKey: "settingsD.searchReviewGuideInstructions",
    to: "/settings/source-control",
    targetId: "review-guides",
    searchTerms: ["pull request pr guided review guide preferences taste prompt custom"],
    environmentOnly: true,
    scope: "project-defaults",
  },
  {
    id: "project-actions",
    // i18n-ignore: English search source, shown through titleKey
    title: "Actions",
    titleKey: "settingsD.searchProjectActions",
    to: "/settings/projects",
    searchTerms: ["commands scripts setup run dev server checkout worktree t3.json import"],
  },
  {
    id: "environment-icon",
    // i18n-ignore: English search source, shown through titleKey
    title: "Environment icon",
    titleKey: "settingsD.searchEnvironmentIcon",
    to: "/settings/connections",
    targetId: "connections-environment",
    searchTerms: ["machine glyph sidebar mac mini studio laptop desktop server cloud vm"],
  },
  {
    id: "local-environment",
    // i18n-ignore: English search source, shown through titleKey
    title: "Local environment",
    titleKey: "settingsD.searchLocalEnvironment",
    to: "/settings/connections",
    targetId: "connections-environment",
    searchTerms: ["turn off on disable enable local server agents remote only restart"],
    desktopOnly: true,
  },
  {
    id: "network-access",
    // i18n-ignore: English search source, shown through titleKey
    title: "Network access",
    titleKey: "settingsD.searchNetworkAccess",
    to: "/settings/connections",
    targetId: "connections-environment",
    searchTerms: ["expose backend remote pairing local machine interfaces host restart"],
    localBackendManagementOnly: true,
  },
  {
    id: "tailscale-https",
    // i18n-ignore: English search source, shown through titleKey
    title: "Tailscale HTTPS",
    titleKey: "settingsD.searchTailscaleHttps",
    to: "/settings/connections",
    targetId: "connections-environment",
    searchTerms: ["serve magicdns endpoint remote secure network"],
    desktopOnly: true,
    localBackendManagementOnly: true,
  },
  {
    id: "wsl-backend",
    // i18n-ignore: English search source, shown through titleKey
    title: "WSL backend",
    titleKey: "settingsD.searchWslBackend",
    to: "/settings/connections",
    searchTerms: [
      "windows subsystem linux distro second server projects stop windows backend restart",
    ],
    desktopOnly: true,
    windowsOnly: true,
    localBackendManagementOnly: true,
    wslAvailableOnly: true,
  },
  {
    id: "t3-connect",
    localEnvironmentOnly: true,
    // i18n-ignore: English search source, shown through titleKey
    title: "T3 Connect",
    titleKey: "settingsD.searchT3Connect",
    to: "/settings/connections",
    targetId: "connections-environment",
    searchTerms: ["managed tunnel cloud other devices remote"],
    desktopOnly: true,
    cloudOnly: true,
  },
  {
    id: "hold-webhooks-while-offline",
    localEnvironmentOnly: true,
    // i18n-ignore: English search source, shown through titleKey
    title: "Hold webhooks while offline",
    titleKey: "settingsD.searchHoldWebhooksWhileOffline",
    to: "/settings/connections",
    targetId: "connections-environment",
    searchTerms: ["webhook automations offline queue mailbox t3 connect"],
    cloudOnly: true,
    managedTunnelOnly: true,
  },
  {
    id: "publish-agent-activity",
    localEnvironmentOnly: true,
    // i18n-ignore: English search source, shown through titleKey
    title: "Publish agent activity",
    titleKey: "settingsD.searchPublishAgentActivity",
    to: "/settings/connections",
    targetId: "connections-environment",
    searchTerms: ["mobile push notifications live activities cloud tunnel"],
    cloudOnly: true,
  },
  {
    id: "connections-environment",
    // i18n-ignore: English search source, shown through titleKey
    title: "This machine",
    titleKey: "settingsD.searchConnectionsEnvironment",
    to: "/settings/connections",
    searchTerms: [
      "connections server backend local remote access administrative permissions scope pairing links qr code authorized clients sessions revoke endpoint",
    ],
  },
  {
    id: "remote-environments",
    // i18n-ignore: English search source, shown through titleKey
    title: "Environments",
    titleKey: "settingsD.searchRemoteEnvironments",
    to: "/settings/connections",
    searchTerms: ["add pair backend host code ssh config agent tunnel saved t3 connect"],
  },
  {
    id: "load-balancing",
    // i18n-ignore: English search source, shown through titleKey
    title: "Load balancing",
    titleKey: "settingsD.searchLoadBalancing",
    to: "/settings/connections",
    searchTerms: [
      "automatic machine environment resources cpu memory capacity preference weight shared projects",
    ],
  },
  {
    id: "github-routing",
    // i18n-ignore: English search source, shown through titleKey
    title: "GitHub sharing",
    titleKey: "settingsD.searchGithubRouting",
    to: "/settings/connections",
    searchTerms: ["pull request trusted environments shared credentials permissions read actions"],
  },
  {
    id: "archive",
    // i18n-ignore: English search source, shown through titleKey
    title: "Archived threads",
    titleKey: "settingsD.searchArchive",
    to: "/settings/archived",
    searchTerms: ["restore reopen deleted history projects"],
  },
] as const satisfies ReadonlyArray<SettingsSearchItem>;

export type SettingsSearchItemId = (typeof SETTINGS_SEARCH_ITEMS)[number]["id"];

const SEARCH_ITEMS_BY_ID = new Map(SETTINGS_SEARCH_ITEMS.map((item) => [item.id, item] as const));

const SETTINGS_CATEGORY_SCOPES: Readonly<Record<SettingsPath, SettingsSearchScope | null>> = {
  "/settings/diagnostics": "environment",
  "/settings/projects": "project",
  "/settings/general": null,
  "/settings/appearance": null,
  "/settings/snap-shot": null,
  // Keybindings fan out to the selection; Providers shows the representative
  // environment at any selection. Neither needs a particular scope to render.
  "/settings/keybindings": null,
  "/settings/providers": null,
  "/settings/integrations": null,
  "/settings/source-control": "environment-defaults",
  "/settings/storage": "project-defaults",
  "/settings/connections": "connections",
  "/settings/scheduled-tasks": null,
  "/settings/archived": "project-defaults",
};

/** Search keeps the selected target. A missing row can explain its owning scope instead. */
export function getSettingsSearchTargetScope(targetId: string) {
  const items: readonly SettingsSearchItem[] = SETTINGS_SEARCH_ITEMS;
  const item =
    items.find((candidate) => candidate.id === targetId) ??
    items.find((candidate) => candidate.targetId === targetId);
  return item
    ? {
        title: item.title,
        scope: item.scope ?? SETTINGS_CATEGORY_SCOPES[item.to],
        ...(item.requiresThreadAutoSettlement ? { requiresThreadAutoSettlement: true } : {}),
      }
    : null;
}

interface AutoSettlementSearchEnvironment {
  readonly environmentId: EnvironmentId;
  readonly connection: { readonly phase: EnvironmentConnectionPhase };
  readonly serverConfig: {
    readonly environment: {
      readonly capabilities: { readonly threadAutoSettlement?: boolean };
    };
  } | null;
}

/** Discovery needs one capable environment; the selected page needs every connected target to support it. */
export function getThreadAutoSettlementSearchAvailability(
  environments: readonly AutoSettlementSearchEnvironment[],
  scope?: Pick<ResolvedSettingsScope, "kind" | "environmentIds">,
) {
  const connected = environments.filter(
    (environment) =>
      environment.connection.phase === "connected" && environment.serverConfig !== null,
  );
  const eligibleEnvironmentIds = connected
    .filter(
      (environment) =>
        environment.serverConfig?.environment.capabilities.threadAutoSettlement === true,
    )
    .map((environment) => environment.environmentId);
  const selected = connected.filter((environment) =>
    scope?.environmentIds.includes(environment.environmentId),
  );
  return {
    eligibleEnvironmentIds,
    isTargetAvailable:
      scope !== undefined &&
      scope.kind !== "unavailable" &&
      selected.length > 0 &&
      selected.every((environment) => eligibleEnvironmentIds.includes(environment.environmentId)),
  };
}

export function isSettingsSearchScopeAvailable(
  requiredScope: SettingsSearchScope | null,
  scopeKind: ResolvedSettingsScope["kind"],
): boolean {
  switch (requiredScope) {
    case null:
    case "connections":
      return true;
    case "environment":
    case "checkout":
      return requiredScope === scopeKind;
    case "project":
      return scopeKind === "project" || scopeKind === "checkout";
    case "environment-defaults":
      return scopeKind === "environment" || scopeKind === "all";
    case "project-defaults":
      return (
        scopeKind === "environment" ||
        scopeKind === "all" ||
        scopeKind === "project" ||
        scopeKind === "checkout"
      );
  }
}

function settingsScopeKindFromSearch(search: SettingsScopeSearch): ResolvedSettingsScope["kind"] {
  const target = validateSettingsScopeSearch({ ...search });
  if (target.checkout && !target.project) return "unavailable";
  if (target.project) return target.checkout ? "checkout" : "project";
  return target.machine ? "environment" : "all";
}

export function isSettingsOverviewVisible(search: SettingsScopeSearch): boolean {
  const kind = settingsScopeKindFromSearch(search);
  return kind === "project" || kind === "checkout";
}

/**
 * `id` and `title` props for the element a search item anchors to. Panels
 * spread (or pick from) this instead of restating the strings, so the catalog
 * and the rendered settings cannot drift apart.
 */
export function searchableSetting(id: SettingsSearchItemId): {
  readonly id: string;
  readonly title: string;
} {
  const { id: anchorId, title } = SEARCH_ITEMS_BY_ID.get(id)!;
  return { id: anchorId, title };
}

/** Catalog key of a searchable setting's translated title, when it has one. */
export function searchableSettingTitleKey(id: SettingsSearchItemId): MessageKey | undefined {
  const item: SettingsSearchItem | undefined = SEARCH_ITEMS_BY_ID.get(id);
  return item?.titleKey;
}

export function filterAvailableSettingsSearchItems(
  availability: SettingsSearchAvailability,
): ReadonlyArray<SettingsSearchItem> {
  const items: ReadonlyArray<SettingsSearchItem> = SETTINGS_SEARCH_ITEMS;
  return items.filter(
    (item) =>
      (!item.cloudOnly || availability.hasCloudPublicConfig) &&
      (!item.environmentOnly || availability.hasEnvironment) &&
      (!item.providerSettingsOnly || availability.hasProviderSettingsEnvironment) &&
      (!item.macProviderSettingsOnly || availability.hasMacProviderSettingsEnvironment) &&
      (!item.localBackendManagementOnly || availability.canManageLocalBackend) &&
      (!item.localEnvironmentOnly || !availability.localEnvironmentDisabled) &&
      (!item.wslAvailableOnly || availability.isWslSettingsRowVisible) &&
      (!item.requiresThreadAutoSettlement || availability.hasThreadAutoSettlement) &&
      (!item.managedTunnelOnly || availability.managedTunnelActive === true),
  );
}

const ENGLISH = createTranslator("en");

/** Titles a search matches: the shown one first, then its English source. */
export function settingsSearchTitles(item: SettingsSearchItem, t: Translate): readonly string[] {
  return item.titleKey ? searchLabels(t, item.titleKey) : [item.title];
}

function rankTitle(title: string, normalizedQuery: string, queryTokens: readonly string[]) {
  if (title === normalizedQuery) return 5;
  if (title.startsWith(normalizedQuery)) return 4;
  if (title.includes(normalizedQuery)) return 3;
  return queryTokens.every((token) => title.includes(token)) ? 2 : 0;
}

export function searchSettings(
  query: string,
  items: ReadonlyArray<SettingsSearchItem> = SETTINGS_SEARCH_ITEMS,
  t: Translate = ENGLISH,
): ReadonlyArray<SettingsSearchItem> {
  const normalizedQuery = normalizeSearchText(query);
  if (normalizedQuery.length === 0) return [];
  const queryTokens = normalizedQuery.split(" ");
  const platform = typeof navigator === "undefined" ? "" : navigator.platform;

  return items
    .flatMap((item, index) => {
      if (!isElectron && item.desktopOnly === true) return [];
      if (item.releaseChannelOnly && !isElectron && HOSTED_APP_CHANNEL === null) return [];
      if (item.macOnly && !isMacPlatform(platform)) return [];
      if (item.windowsOnly && !isWindowsPlatform(platform)) return [];

      const titles = settingsSearchTitles(item, t).map(normalizeSearchText);
      const fields = [
        ...titles,
        normalizeSearchText(SETTINGS_SECTION_LABELS[item.to]),
        ...(item.searchTerms ?? []).map(normalizeSearchText),
      ];
      if (!queryTokens.every((token) => fields.some((field) => field.includes(token)))) return [];

      const exactPhraseField = fields.findIndex((field) => field.includes(normalizedQuery));
      const rank = Math.max(
        ...titles.map((title) => rankTitle(title, normalizedQuery, queryTokens)),
        exactPhraseField >= 0 ? 1 : 0,
      );
      return [{ item, index, rank }];
    })
    .toSorted(
      (left, right) =>
        Number(left.item.secondary ?? false) - Number(right.item.secondary ?? false) ||
        right.rank - left.rank ||
        left.index - right.index,
    )
    .map(({ item }) => item);
}
