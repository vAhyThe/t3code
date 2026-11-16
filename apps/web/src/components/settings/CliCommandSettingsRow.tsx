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

const FAILURE_TITLES = {
  install: "settingsA.cliCommandInstallFailed",
  uninstall: "settingsA.cliCommandRemoveFailed",
  addToPath: "settingsA.cliCommandAddToPathFailed",
} as const;

/** The desktop `t3` command's state, and its actions with a toast on failure. */
export function useDesktopCliCommand() {
  const bridge = getDesktopCliCommandBridge();
  const query = useEnvironmentQuery(bridge ? desktopCliCommandStateAtom : null);
  const [pending, setPending] = useState(false);

  const run = (action: keyof typeof FAILURE_TITLES) => {
    if (!bridge || pending) return;
    setPending(true);
    void bridge[action]()
      .then(refreshDesktopCliCommandState)
      .catch((error: unknown) => {
        toastManager.add(
          stackedThreadToast({
            type: "error",
            title: currentTranslator()(FAILURE_TITLES[action]),
            description:
              error instanceof Error
                ? error.message
                : currentTranslator()("settingsA.cliCommandFallbackError"),
          }),
        );
      })
      .finally(() => setPending(false));
  };

  return {
    state: bridge ? query.data : undefined,
    busy: pending || query.isPending,
    run,
  };
}

export function CliCommandSettingsRow() {
  const { state, busy, run } = useDesktopCliCommand();

  if (!state?.supported) return null;
  const installed = state.installedPath !== null;
  const description = state.shadowedBy
    ? currentTranslator()("settingsA.cliCommandShadowed", { path: state.shadowedBy })
    : !installed
      ? currentTranslator()("settingsA.cliCommandNotInstalled")
      : state.onPath
        ? currentTranslator()("settingsA.cliCommandInstalled", { path: state.installedPath ?? "" })
        : state.pathSetup?.added
          ? currentTranslator()("settingsA.cliCommandAddedToPath", {
              path: state.installedPath ?? "",
              file: state.pathSetup.file,
            })
          : state.pathSetup
            ? currentTranslator()("settingsA.cliCommandNotOnPathYet", {
                path: state.installedPath ?? "",
              })
            : currentTranslator()("settingsA.cliCommandNotOnPath", {
                path: state.installedPath ?? "",
              });

  return (
    <SettingsRow
      {...searchableSetting("cli-command")}
      description={description}
      control={
        <div className="flex gap-2">
          {state.pathSetup && !state.pathSetup.added ? (
            <Button size="sm" variant="outline" disabled={busy} onClick={() => run("addToPath")}>
              {currentTranslator()("settingsA.cliCommandAddToPath")}
            </Button>
          ) : null}
          <Button
            size="sm"
            variant="outline"
            disabled={busy || (!installed && Boolean(state.shadowedBy))}
            onClick={() => run(installed ? "uninstall" : "install")}
          >
            {installed
              ? currentTranslator()("settingsA.cliCommandRemove")
              : currentTranslator()("settingsA.cliCommandInstall")}
          </Button>
        </div>
      }
    />
  );
}
