import type {
  StorageCleanupReport,
  StorageCleanupSettings,
  WorktreeCleanupRules,
} from "@t3tools/contracts";
import { resolveWorktreeCleanup } from "@t3tools/shared/projectSettings";
import { useMemo, useRef, useState } from "react";
import { useAtomValue } from "@effect/atom-react";
import { Atom } from "effect/reactivity";
import {
  isAtomCommandInterrupted,
  squashAtomCommandFailure,
} from "@t3tools/client-runtime/state/runtime";
import { formatBytes } from "../../lib/formatBytes";
import { serverEnvironment } from "../../state/server";
import { useAtomCommand } from "../../state/use-atom-command";
import { formatRelativeTimeLabel } from "../../timestampFormat";
import { useT } from "~/i18n/I18nProvider";
import { Button } from "../ui/button";
import { toastManager } from "../ui/toast";

import { Input } from "../ui/input";
import { Select, SelectItem, SelectPopup, SelectTrigger, SelectValue } from "../ui/select";
import { Switch } from "../ui/switch";
import {
  NumberField,
  NumberFieldDecrement,
  NumberFieldGroup,
  NumberFieldIncrement,
  NumberFieldInput,
} from "../ui/number-field";
import {
  SettingResetButton,
  SettingsPageContainer,
  SettingsRow,
  SettingsSection,
  useRelativeTimeTick,
} from "./settingsLayout";
import { SettingsScopeNotice } from "./SettingsScopeNotice";
import { FoldedSettingsSection } from "./FoldedSettingsSection";
import { SettingsGroup } from "./SettingsGroup";
import type { ScopedSettingsTarget } from "./scopedSettings";
import { useSettingsScope } from "./SettingsScopeContext";
import { searchableSetting } from "./settingsSearch";
import {
  useClearScopedSettings,
  useScopedSettings,
  useScopedSettingsMixed,
  useUpdateScopedSettings,
} from "./useScopedSettings";

function WorktreesDirectoryRow() {
  const t = useT();
  const { connectedEnvironments, targets } = useSettingsScope();
  const settings = useScopedSettings();
  const updateSettings = useUpdateScopedSettings();
  const mixed = useScopedSettingsMixed(["worktreesDirectory"]);
  const edited = useRef(false);
  if (
    connectedEnvironments.some(
      (environment) =>
        environment.serverConfig?.environment.capabilities.worktreesDirectory !== true,
    )
  )
    return null;
  const scopeKey = targets.map((target) => target.environmentId).join(",");

  return (
    <SettingsRow
      {...searchableSetting("storage-worktrees-location")}
      description={t("settingsD.worktreeLocationDescription")}
      serverScoped
      settingKeys={["worktreesDirectory"]}
      resetAction={
        mixed || settings.worktreesDirectory !== "" ? (
          <SettingResetButton
            label={t("settingsD.worktreeLocationLower")}
            onClick={() => updateSettings({ worktreesDirectory: "" })}
          />
        ) : null
      }
      control={
        <Input
          key={`${scopeKey}:${mixed}:${settings.worktreesDirectory}`}
          aria-label={t("settingsD.worktreeLocation")}
          autoCapitalize="none"
          spellCheck={false}
          placeholder={mixed ? t("settingsD.mixed") : t("settingsD.defaultMarker")}
          defaultValue={mixed ? "" : settings.worktreesDirectory}
          onChange={() => {
            edited.current = true;
          }}
          onBlur={(event) => {
            const value = event.target.value.trim();
            if (edited.current && (mixed || value !== settings.worktreesDirectory))
              updateSettings({ worktreesDirectory: value });
            edited.current = false;
          }}
        />
      }
    />
  );
}

function RetentionControl({
  label,
  value,
  onChange,
  minimum = 1,
}: {
  label: string;
  value: number | null;
  onChange: (value: number | null) => void;
  minimum?: number;
}) {
  const t = useT();
  const [draft, setDraft] = useState(value);
  const [savedValue, setSavedValue] = useState(value);
  if (savedValue !== value) {
    setSavedValue(value);
    setDraft(value);
  }

  return (
    <div className="flex items-center gap-3">
      {value !== null ? (
        <NumberField
          value={draft}
          min={minimum}
          max={3650}
          step={1}
          size="sm"
          className="w-auto"
          onValueChange={setDraft}
          onValueCommitted={(next) => {
            if (next === null) setDraft(value);
            else {
              const days = Math.min(3650, Math.max(minimum, Math.round(next)));
              setDraft(days);
              onChange(days);
            }
          }}
        >
          <NumberFieldGroup>
            <NumberFieldDecrement aria-label={t("settingsD.decreaseLabel", { label })} />
            <NumberFieldInput
              aria-label={t("settingsD.labelInDays", { label })}
              size={new Intl.NumberFormat().format(draft ?? value).length}
              className="field-sizing-content w-auto min-w-[1ch] grow-0 text-right"
            />
            <span aria-hidden="true" className="self-center pr-2 text-xs">
              {t("settingsD.daysUnit", { count: Number(draft ?? value) })}
            </span>
            <NumberFieldIncrement aria-label={t("settingsD.increaseLabel", { label })} />
          </NumberFieldGroup>
        </NumberField>
      ) : (
        <span className="text-xs text-muted-foreground">{t("settingsD.off")}</span>
      )}
      <Switch
        aria-label={label}
        checked={value !== null}
        onCheckedChange={(enabled) => onChange(enabled ? 8 : null)}
      />
    </div>
  );
}

const KEEP_WHEN_LABEL_KEYS = {
  "any-local-files": "settingsD.keepAnyLocalFiles",
  "uncommitted-changes": "settingsD.keepUncommittedChanges",
  "tracked-changes": "settingsD.keepEditedTrackedFiles",
} as const;

function CleanupResults({
  report,
  environmentLabel,
}: {
  report: StorageCleanupReport;
  environmentLabel: string | undefined;
}) {
  const t = useT();
  return (
    <>
      {report.entries.map((entry, index) => {
        const name =
          entry.kind === "worktree"
            ? (entry.path?.split(/[\\/]/).findLast(Boolean) ?? t("settingsD.worktrees"))
            : entry.kind === "logs"
              ? t("settingsD.rotatedLogs")
              : t("settingsD.browserArtifacts");
        return (
          <SettingsRow
            key={`${entry.path ?? entry.kind}:${entry.threadId ?? index}`}
            title={environmentLabel ? `${environmentLabel}: ${name}` : name}
            description={
              <span
                className={`wrap-anywhere ${entry.outcome === "failed" ? "text-destructive" : ""}`}
              >
                {entry.threadTitle && entry.threadTitle !== name ? `${entry.threadTitle}. ` : ""}
                {entry.reason}
              </span>
            }
            control={
              entry.outcome === "removed" && (
                <span className="text-xs text-muted-foreground">
                  {[
                    entry.kind !== "worktree" && entry.files !== null
                      ? t("settingsD.filesCount", {
                          count: entry.files,
                          number: entry.files.toLocaleString(),
                        })
                      : null,
                    entry.bytes !== null ? formatBytes(entry.bytes) : null,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
              )
            }
          />
        );
      })}
      {report.omittedCount > 0 && (
        <p className="px-3 py-2.5 text-xs text-muted-foreground sm:px-4">
          {environmentLabel ? `${environmentLabel}: ` : ""}
          {t("settingsD.moreResults", {
            count: report.omittedCount,
            number: report.omittedCount.toLocaleString(),
          })}
        </p>
      )}
      {report.entries.length === 0 && report.omittedCount === 0 && (
        <p className="px-3 py-2.5 text-xs text-muted-foreground sm:px-4">
          {environmentLabel ? `${environmentLabel}: ` : ""}
          {t("settingsD.nothingNeededCleanup")}
        </p>
      )}
    </>
  );
}

function CleanupSection() {
  useRelativeTimeTick(60_000);
  const t = useT();
  const { connectedEnvironments } = useSettingsScope();
  const [pending, setPending] = useState(false);
  const run = useAtomCommand(serverEnvironment.runStorageCleanup);
  const supported = connectedEnvironments.filter(
    (environment) => environment.serverConfig?.environment.capabilities.storageCleanupRun === true,
  );
  const state = useAtomValue(
    useMemo(
      () =>
        Atom.make((get) =>
          connectedEnvironments.flatMap((environment) => {
            if (environment.serverConfig?.environment.capabilities.storageCleanupRun !== true)
              return [];
            const query = get(
              serverEnvironment.storageCleanupReport({
                environmentId: environment.environmentId,
                input: {},
              }),
            );
            return [
              {
                environmentId: environment.environmentId,
                allowed: get(
                  serverEnvironment.runStorageCleanup.permissionAtom(environment.environmentId),
                ),
                report: query._tag === "Success" ? query.value : null,
                loading: query.waiting,
                failed: query._tag === "Failure",
              },
            ];
          }),
        ),
      [connectedEnvironments],
    ),
  );
  const hasRules = supported.some((environment) => {
    const settings = environment.serverConfig?.settings;
    if (!settings) return false;
    const enabled = (rules: WorktreeCleanupRules) =>
      rules.worktreeAfterDays !== null ||
      rules.worktreeSettledAfterDays !== null ||
      rules.worktreeOnMerge ||
      rules.worktreeOnDelete ||
      rules.worktreeUnchanged;
    return (
      settings.storageCleanup.browserArtifactsAfterDays !== null ||
      settings.storageCleanup.logsAfterDays !== null ||
      enabled(resolveWorktreeCleanup(settings, null)) ||
      Object.values(settings.projectSettingsOverrides).some(
        (override) =>
          override.worktreeCleanup?.mode === "custom" && enabled(override.worktreeCleanup.rules),
      )
    );
  });
  if (supported.length === 0) return null;
  const summaries = supported.map((environment) => {
    const query = state.find((entry) => entry.environmentId === environment.environmentId);
    const report = query?.report ?? null;
    return {
      environment,
      report,
      description: report
        ? [
            t("settingsD.lastRunSummary", {
              time: formatRelativeTimeLabel(report.finishedAt),
              bytes: formatBytes(report.bytesFreed),
            }),
            report.counts.failed > 0
              ? t("settingsD.failedItemsNotRemoved", { count: report.counts.failed })
              : null,
          ]
            .filter(Boolean)
            .join(" ")
        : query?.failed
          ? t("settingsD.couldNotLoadLastRun")
          : query?.loading
            ? t("settingsD.loadingLastRun")
            : t("settingsD.cleanupNotRunYet"),
    };
  });
  const deleteNow = async () => {
    if (pending) return;
    setPending(true);
    try {
      await Promise.all(
        supported
          .filter((environment) =>
            state.some(
              (entry) => entry.environmentId === environment.environmentId && entry.allowed,
            ),
          )
          .map(async (environment) => {
            const result = await run({ environmentId: environment.environmentId, input: {} });
            if (result._tag === "Success") {
              const failures = result.value.entries.filter((entry) => entry.outcome === "failed");
              if (failures.length > 0)
                toastManager.add({
                  type: "error",
                  title: t("settingsD.cleanupFailedOn", { environment: environment.label }),
                  description: failures[0]!.reason,
                });
            } else if (!isAtomCommandInterrupted(result)) {
              toastManager.add({
                type: "error",
                title: t("settingsD.couldNotRunCleanupOn", { environment: environment.label }),
                description: String(squashAtomCommandFailure(result)),
              });
            }
          }),
      );
    } finally {
      setPending(false);
    }
  };
  return (
    <SettingsSection id="storage-cleanup" title={t("settingsD.cleanupTitle")} variant="plain">
      <SettingsGroup>
        <SettingsRow
          {...searchableSetting("storage-delete-now")}
          description={
            <span>
              {!hasRules
                ? t("settingsD.turnOnCleanupRule")
                : summaries.map(({ environment, description }) => (
                    <span key={environment.environmentId} className="block">
                      {supported.length > 1 ? `${environment.label}: ` : ""}
                      {description}
                    </span>
                  ))}
            </span>
          }
          control={
            <Button
              variant="outline"
              size="sm"
              disabled={pending || !hasRules || !state.some((entry) => entry.allowed)}
              onClick={() => void deleteNow()}
            >
              {pending ? t("settingsD.deleting") : t("settingsD.deleteNow")}
            </Button>
          }
        />
      </SettingsGroup>
      {summaries.some(({ report }) => report !== null) && (
        <FoldedSettingsSection
          id="storage-cleanup-last-run"
          title={t("settingsD.lastRun")}
          headerPlacement="inside"
          summary={summaries
            .flatMap(({ environment, report }) =>
              report
                ? [
                    `${connectedEnvironments.length > 1 ? `${environment.label}: ` : ""}${report.counts.failed > 0 ? t("settingsD.summaryWithFailures", { removed: report.counts.removed, kept: report.counts.kept, failed: report.counts.failed }) : t("settingsD.summary", { removed: report.counts.removed, kept: report.counts.kept })}`,
                  ]
                : [],
            )
            .join(" · ")}
        >
          {summaries.map(
            ({ environment, report }) =>
              report && (
                <CleanupResults
                  key={environment.environmentId}
                  report={report}
                  environmentLabel={
                    connectedEnvironments.length > 1 ? environment.label : undefined
                  }
                />
              ),
          )}
        </FoldedSettingsSection>
      )}
    </SettingsSection>
  );
}

export function StorageSettingsPanel() {
  const t = useT();
  const { scope, environments, connectedEnvironments, targets, target } = useSettingsScope();
  const scopedSettings = useScopedSettings();
  const isProjectScope = scope.kind === "project" || scope.kind === "checkout";
  const settings = {
    ...scopedSettings.storageCleanup,
    ...resolveWorktreeCleanup(scopedSettings, null),
  };
  const projectMode = (entry: ScopedSettingsTarget | null) =>
    entry?.sources.worktreeCleanup === "project"
      ? (entry.settings.worktreeCleanup?.mode ?? "inherit")
      : "inherit";
  const mode = projectMode(target);
  const mixedModes = targets.some((entry) => projectMode(entry) !== mode);
  const updateSettings = useUpdateScopedSettings();
  const clearSettings = useClearScopedSettings();
  const ruleStatus = (key: keyof StorageCleanupSettings) =>
    targets.some(
      (target) =>
        ({ ...target.settings.storageCleanup, ...resolveWorktreeCleanup(target.settings, null) })[
          key
        ] !== settings[key],
    )
      ? t("settingsD.mixedAcrossMachines")
      : undefined;
  const update = (patch: Partial<StorageCleanupSettings>) =>
    updateSettings({ storageCleanup: patch });
  const updateWorktree = (patch: Partial<WorktreeCleanupRules>) =>
    isProjectScope
      ? updateSettings({ worktreeCleanup: { mode: "custom", rules: patch } })
      : update(patch);

  if (
    isProjectScope &&
    connectedEnvironments.some(
      (environment) =>
        environment.serverConfig?.environment.capabilities.projectWorktreeCleanup !== true,
    )
  ) {
    return (
      <SettingsScopeNotice target="all">
        {t("settingsD.updateSelectedMachinesForWorktreeCleanup")}
      </SettingsScopeNotice>
    );
  }

  if (
    connectedEnvironments.some(
      (environment) => environment.serverConfig?.environment.capabilities.storageCleanup !== true,
    )
  ) {
    return (
      <SettingsScopeNotice
        target="environment"
        eligibleEnvironmentIds={connectedEnvironments
          .filter(
            (environment) =>
              environment.serverConfig?.environment.capabilities.storageCleanup === true,
          )
          .map((environment) => environment.environmentId)}
      >
        {t("settingsD.updateSelectedEnvironmentsForStorageCleanup")}
      </SettingsScopeNotice>
    );
  }

  return (
    <SettingsPageContainer>
      <SettingsSection id="storage-worktrees" title={t("settingsD.worktrees")}>
        {!isProjectScope && <WorktreesDirectoryRow />}
        {isProjectScope && (
          <SettingsRow
            title={t("settingsD.automaticWorktreeCleanup")}
            description={
              mode === "off"
                ? t("settingsD.projectWorktreesKeptUntilDeleted")
                : mode === "custom"
                  ? t("settingsD.projectWorktreesUseRules")
                  : t("settingsD.projectWorktreesUseMachineSettings")
            }
            serverScoped
            settingKeys={["worktreeCleanup"]}
            mixed={mixedModes}
            control={
              <Select
                value={mixedModes ? null : mode}
                onValueChange={(next) => {
                  if (next === "inherit") clearSettings(["worktreeCleanup"]);
                  else if (next === "off") updateSettings({ worktreeCleanup: { mode: "off" } });
                  else if (next === "custom")
                    updateSettings({ worktreeCleanup: { mode: "custom", rules: {} } });
                }}
              >
                <SelectTrigger size="sm" aria-label={t("settingsD.automaticWorktreeCleanup")}>
                  <SelectValue>
                    {mixedModes
                      ? t("settingsD.mixed")
                      : mode === "inherit"
                        ? t("settingsD.inherit")
                        : mode === "off"
                          ? t("settingsD.off")
                          : t("settingsD.custom")}
                  </SelectValue>
                </SelectTrigger>
                <SelectPopup align="end" alignItemWithTrigger={false}>
                  <SelectItem value="inherit">{t("settingsD.inherit")}</SelectItem>
                  <SelectItem value="off">{t("settingsD.off")}</SelectItem>
                  <SelectItem value="custom">{t("settingsD.custom")}</SelectItem>
                </SelectPopup>
              </Select>
            }
          />
        )}
        {(!isProjectScope || (!mixedModes && mode === "custom")) && (
          <>
            <SettingsRow
              title={t("settingsD.deleteWorktreesWithDeletedThreads")}
              status={ruleStatus("worktreeOnDelete")}
              description={t("settingsD.deleteWorktreesWithDeletedThreadsDescription")}
              serverScoped={!isProjectScope}
              control={
                <Switch
                  aria-label={t("settingsD.deleteWorktreesWithDeletedThreads")}
                  checked={settings.worktreeOnDelete}
                  onCheckedChange={(worktreeOnDelete) => updateWorktree({ worktreeOnDelete })}
                />
              }
            />
            <SettingsRow
              title={t("settingsD.deleteInactiveWorktrees")}
              status={ruleStatus("worktreeAfterDays")}
              description={t("settingsD.deleteInactiveWorktreesDescription")}
              serverScoped={!isProjectScope}
              control={
                <RetentionControl
                  label={t("settingsD.deleteInactiveWorktrees")}
                  value={settings.worktreeAfterDays}
                  onChange={(worktreeAfterDays) => updateWorktree({ worktreeAfterDays })}
                />
              }
            />
            {connectedEnvironments.length > 0 &&
              connectedEnvironments.every(
                (environment) =>
                  environment.serverConfig?.environment.capabilities.settledWorktreeCleanup ===
                  true,
              ) && (
                <SettingsRow
                  title={t("settingsD.deleteSettledWorktrees")}
                  status={[
                    ruleStatus("worktreeSettledAfterDays"),
                    environments.length > connectedEnvironments.length
                      ? t("settingsD.offlineMachinesNoSetting")
                      : undefined,
                  ]
                    .filter(Boolean)
                    .join(". ")}
                  description={t("settingsD.deleteSettledWorktreesDescription")}
                  serverScoped={!isProjectScope}
                  control={
                    <RetentionControl
                      label={t("settingsD.deleteSettledWorktrees")}
                      value={settings.worktreeSettledAfterDays}
                      minimum={0}
                      onChange={(worktreeSettledAfterDays) =>
                        updateWorktree({ worktreeSettledAfterDays })
                      }
                    />
                  }
                />
              )}
            <SettingsRow
              title={t("settingsD.deleteMergedWorktrees")}
              status={ruleStatus("worktreeOnMerge")}
              description={t("settingsD.deleteMergedWorktreesDescription")}
              serverScoped={!isProjectScope}
              control={
                <Switch
                  aria-label={t("settingsD.deleteMergedWorktrees")}
                  checked={settings.worktreeOnMerge}
                  onCheckedChange={(worktreeOnMerge) => updateWorktree({ worktreeOnMerge })}
                />
              }
            />
            <SettingsRow
              title={t("settingsD.deleteUnchangedWorktrees")}
              status={ruleStatus("worktreeUnchanged")}
              description={t("settingsD.deleteUnchangedWorktreesDescription")}
              serverScoped={!isProjectScope}
              control={
                <Switch
                  aria-label={t("settingsD.deleteUnchangedWorktrees")}
                  checked={settings.worktreeUnchanged}
                  onCheckedChange={(worktreeUnchanged) => updateWorktree({ worktreeUnchanged })}
                />
              }
            />
            {connectedEnvironments.every(
              (environment) =>
                environment.serverConfig?.environment.capabilities.storageCleanupRun === true,
            ) && (
              <SettingsRow
                {...searchableSetting("storage-worktree-keep-when")}
                status={ruleStatus("worktreeKeepWhen")}
                description={
                  settings.worktreeKeepWhen === "any-local-files"
                    ? t("settingsD.keepWhenAnyLocalFilesDescription")
                    : settings.worktreeKeepWhen === "tracked-changes"
                      ? t("settingsD.keepWhenTrackedChangesDescription")
                      : t("settingsD.keepWhenUncommittedChangesDescription")
                }
                serverScoped={!isProjectScope}
                control={
                  <Select
                    value={ruleStatus("worktreeKeepWhen") ? null : settings.worktreeKeepWhen}
                    onValueChange={(next) => {
                      if (
                        next === "any-local-files" ||
                        next === "uncommitted-changes" ||
                        next === "tracked-changes"
                      )
                        updateWorktree({ worktreeKeepWhen: next });
                    }}
                  >
                    <SelectTrigger
                      size="sm"
                      aria-label={t("settingsD.keepWorktreesWithLocalChanges")}
                    >
                      <SelectValue>
                        {ruleStatus("worktreeKeepWhen")
                          ? t("settingsD.mixed")
                          : t(KEEP_WHEN_LABEL_KEYS[settings.worktreeKeepWhen])}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectPopup align="end" alignItemWithTrigger={false}>
                      <SelectItem value="any-local-files">
                        {t("settingsD.keepAnyLocalFiles")}
                      </SelectItem>
                      <SelectItem value="uncommitted-changes">
                        {t("settingsD.keepUncommittedChanges")}
                      </SelectItem>
                      <SelectItem value="tracked-changes">
                        {t("settingsD.keepEditedTrackedFiles")}
                      </SelectItem>
                    </SelectPopup>
                  </Select>
                }
              />
            )}
          </>
        )}
      </SettingsSection>

      {!isProjectScope && (
        <SettingsSection id="storage-artifacts" title={t("settingsD.artifactsAndLogs")}>
          <SettingsRow
            title={t("settingsD.deleteOldBrowserArtifacts")}
            status={ruleStatus("browserArtifactsAfterDays")}
            description={t("settingsD.deleteOldBrowserArtifactsDescription")}
            serverScoped
            control={
              <RetentionControl
                label={t("settingsD.deleteOldBrowserArtifacts")}
                value={settings.browserArtifactsAfterDays}
                onChange={(browserArtifactsAfterDays) => update({ browserArtifactsAfterDays })}
              />
            }
          />
          <SettingsRow
            title={t("settingsD.deleteOldRotatedLogs")}
            status={ruleStatus("logsAfterDays")}
            description={t("settingsD.deleteOldRotatedLogsDescription")}
            serverScoped
            control={
              <RetentionControl
                label={t("settingsD.deleteOldRotatedLogs")}
                value={settings.logsAfterDays}
                onChange={(logsAfterDays) => update({ logsAfterDays })}
              />
            }
          />
        </SettingsSection>
      )}
      {!isProjectScope && <CleanupSection />}
    </SettingsPageContainer>
  );
}
