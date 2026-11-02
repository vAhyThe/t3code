import { currentTranslator } from "~/i18n/I18nProvider";
import { useState } from "react";

import {
  desktopCliCommandStateAtom,
  getDesktopCliCommandBridge,
  refreshDesktopCliCommandState,
} from "~/state/desktopCliCommand";
import { useEnvironmentQuery } from "~/state/query";
import { Button } from "../ui/button";
import { stackedThreadToast, toastManager } from "../ui/toast";
import { SettingsRow } from "./settingsLayout";
import { searchableSetting } from "./settingsSearch";

export function CliCommandSettingsRow() {
  const bridge = getDesktopCliCommandBridge();
  const query = useEnvironmentQuery(bridge ? desktopCliCommandStateAtom : null);
  const state = query.data;
  const [pending, setPending] = useState(false);

  const change = (action: "install" | "uninstall") => {
    if (!bridge || pending) return;
    setPending(true);
    void bridge[action]()
      .then(refreshDesktopCliCommandState)
      .catch((error: unknown) => {
        toastManager.add(
          stackedThreadToast({
            type: "error",
            title:
              action === "install"
                ? currentTranslator()("settingsA.cliCommandInstallFailed")
                : currentTranslator()("settingsA.cliCommandRemoveFailed"),
            description:
              error instanceof Error
                ? error.message
                : currentTranslator()("settingsA.cliCommandFallbackError"),
          }),
        );
      })
      .finally(() => setPending(false));
  };

  if (!bridge || !state?.supported) return null;
  const installed = state.installedPath !== null;
  const description = state.shadowedBy
    ? currentTranslator()("settingsA.cliCommandShadowed", { path: state.shadowedBy })
    : !installed
      ? currentTranslator()("settingsA.cliCommandNotInstalled")
      : state.onPath
        ? currentTranslator()("settingsA.cliCommandInstalled", { path: state.installedPath ?? "" })
        : currentTranslator()("settingsA.cliCommandNotOnPath", { path: state.installedPath ?? "" });

  return (
    <SettingsRow
      {...searchableSetting("cli-command")}
      description={description}
      control={
        <Button
          size="sm"
          variant="outline"
          disabled={pending || query.isPending || (!installed && Boolean(state.shadowedBy))}
          onClick={() => change(installed ? "uninstall" : "install")}
        >
          {installed
            ? currentTranslator()("settingsA.cliCommandRemove")
            : currentTranslator()("settingsA.cliCommandInstall")}
        </Button>
      }
    />
  );
}
