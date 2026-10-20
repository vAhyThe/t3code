import { useAtomValue } from "@effect/atom-react";
import { shouldRecommendDatabaseCompaction, type EnvironmentId } from "@t3tools/contracts";
import * as Schema from "effect/Schema";

import { useT } from "~/i18n/I18nProvider";
import { useCopyToClipboard } from "../../hooks/useCopyToClipboard";
import { useLocalStorage } from "../../hooks/useLocalStorage";
import { serverEnvironment } from "../../state/server";
import { Button } from "../ui/button";
import { SettingsGroup } from "./SettingsGroup";
import { SettingsRow, SettingsSection } from "./settingsLayout";

/** Suggests `t3 doctor` for a database that still holds at least 1 GiB of freed pages. */
export function DatabaseStorageNotice({
  environmentId,
  label,
}: {
  environmentId: EnvironmentId;
  label: string;
}) {
  const t = useT();
  const result = useAtomValue(serverEnvironment.databaseStorage({ environmentId, input: {} }));
  const [dismissed, setDismissed] = useLocalStorage(
    `database-storage-notice-dismissed:${environmentId}`,
    false,
    Schema.Boolean,
  );
  const { copyToClipboard } = useCopyToClipboard({ target: "command" });
  const status = result._tag === "Success" ? result.value : null;
  if (dismissed || status === null || !shouldRecommendDatabaseCompaction(status)) return null;
  return (
    <SettingsSection
      id={`storage-database-${environmentId}`}
      title={t("settingsD.databaseStorageTitle")}
    >
      <SettingsGroup>
        <SettingsRow
          title={t("settingsD.databaseReclaimTitle", {
            size: (status.reclaimableBytes / 1024 ** 3).toFixed(1),
            label,
          })}
          description={
            <>
              {t("settingsD.databaseReclaimDescription", { label })}
              <code className="mt-2 block select-text break-all">{status.compactCommand}</code>
            </>
          }
          control={
            <div className="flex flex-wrap items-center gap-1.5">
              <Button
                variant="outline"
                size="sm"
                onClick={() => copyToClipboard(status.compactCommand, undefined)}
              >
                {t("settingsC.copyCommand")}
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setDismissed(true)}>
                {t("shellNav.actionDismiss")}
              </Button>
            </div>
          }
        />
      </SettingsGroup>
    </SettingsSection>
  );
}
