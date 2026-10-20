import { useAtomValue } from "@effect/atom-react";
import { resolveEnvironmentMachineKind } from "@t3tools/contracts";
import {
  gitHubRoutingConnectionKey,
  gitHubRoutingPermissionFor,
  type GitHubRoutingPermission,
} from "@t3tools/client-runtime/connection";
import { useState } from "react";

import { currentTranslator, useT } from "~/i18n/I18nProvider";
import { environmentCatalog } from "~/connection/catalog";
import type { EnvironmentPresentation } from "~/state/environments";
import { useAtomCommand } from "~/state/use-atom-command";
import { Select, SelectItem, SelectPopup, SelectTrigger, SelectValue } from "../ui/select";
import { toastManager } from "../ui/toast";
import { EnvironmentRow, environmentTransportLabel } from "./EnvironmentRow";
import { FoldedSettingsSection } from "./FoldedSettingsSection";
import { searchableSetting } from "./settingsSearch";

const options = [
  { value: "off", labelKey: "settingsB.githubRoutingOff" },
  { value: "read", labelKey: "settingsB.githubRoutingRead" },
  { value: "read-write", labelKey: "settingsB.githubRoutingReadWrite" },
] as const satisfies ReadonlyArray<{ value: GitHubRoutingPermission; labelKey: string }>;

const summaryKeys = {
  "read-write": "settingsB.githubRoutingSummaryReadWrite",
  read: "settingsB.githubRoutingSummaryRead",
} as const;

export function summarizeGitHubRouting(
  entries: ReadonlyArray<{ readonly label: string; readonly permission: GitHubRoutingPermission }>,
): string | null {
  const groups = (["read-write", "read"] as const).flatMap((permission) => {
    const labels = entries.filter((entry) => entry.permission === permission);
    return labels.length === 0
      ? []
      : [
          `${labels.map((entry) => entry.label).join(", ")} ${currentTranslator()(summaryKeys[permission])}`,
        ];
  });
  return groups.length === 0 ? null : groups.join(" · ");
}

export function GitHubRoutingSettings({
  environments,
}: {
  readonly environments: ReadonlyArray<EnvironmentPresentation>;
}) {
  const permissions = useAtomValue(environmentCatalog.githubRoutingPermissionsValueAtom);
  const catalog = useAtomValue(environmentCatalog.catalogValueAtom);
  const update = useAtomCommand(environmentCatalog.setGitHubRoutingPermission);
  const [saving, setSaving] = useState(false);
  const t = useT();

  if (environments.length < 2) return null;

  const { id, title } = searchableSetting("github-routing");
  return (
    <FoldedSettingsSection
      id={id}
      title={title}
      summary={
        summarizeGitHubRouting(
          environments.map((environment) => ({
            label: environment.label,
            permission: gitHubRoutingPermissionFor(environment.entry, permissions),
          })),
        ) ?? t("settingsB.githubRoutingOff")
      }
    >
      <p className="px-3 py-2.5 text-xs text-muted-foreground sm:px-4">
        {t("settingsB.githubRoutingTrust")}
      </p>
      {environments.map((environment) => (
        <EnvironmentRow
          key={environment.environmentId}
          kind={resolveEnvironmentMachineKind(environment.serverConfig)}
          label={environment.label}
          subtitle={environmentTransportLabel(environment)}
        >
          <Select
            items={options.map((option) => ({ value: option.value, label: t(option.labelKey) }))}
            value={gitHubRoutingPermissionFor(environment.entry, permissions)}
            disabled={
              !catalog.isReady || saving || gitHubRoutingConnectionKey(environment.entry) === null
            }
            onValueChange={(permission) => {
              if (permission === null) return;
              setSaving(true);
              void update({ environmentId: environment.environmentId, permission }).then(
                (result) => {
                  setSaving(false);
                  if (result._tag === "Failure")
                    toastManager.add({
                      type: "error",
                      title: t("settingsB.githubRoutingSaveFailed"),
                    });
                },
              );
            }}
          >
            <SelectTrigger
              size="xs"
              className="w-32"
              aria-label={t("settingsB.githubRoutingAria", { name: environment.label })}
            >
              <SelectValue />
            </SelectTrigger>
            <SelectPopup align="end" alignItemWithTrigger={false}>
              {options.map(({ value, labelKey }) => (
                <SelectItem key={value} value={value}>
                  {t(labelKey)}
                </SelectItem>
              ))}
            </SelectPopup>
          </Select>
        </EnvironmentRow>
      ))}
    </FoldedSettingsSection>
  );
}
