import type { ContextMenuItem } from "@t3tools/contracts";
import {
  type SourceControlClientDefinition,
  UNKNOWN_SOURCE_CONTROL_CLIENT,
} from "@t3tools/client-runtime/source-control-clients";

import { writeTextToClipboard } from "~/hooks/useCopyToClipboard";
import { readLocalApi } from "~/localApi";

import { toastManager } from "../ui/toast";
import { currentTranslator } from "../../i18n/I18nProvider";

export type PullRequestLinkContextMenuAction = "copy-link" | "open-external";

export const openOnHostLabel = (host: SourceControlClientDefinition): string => {
  const t = currentTranslator();
  return host === UNKNOWN_SOURCE_CONTROL_CLIENT
    ? t("pullRequest.openOnHost")
    : t("pullRequest.openOnHostNamed", { host: host.label });
};

function pullRequestLinkContextMenuItems(
  openLabel: string,
): readonly ContextMenuItem<PullRequestLinkContextMenuAction>[] {
  const t = currentTranslator();
  return [
    { id: "copy-link", label: t("pullRequest.copyLink"), icon: "copy" },
    { id: "open-external", label: openLabel },
  ];
}

export async function showPullRequestLinkContextMenu({
  url,
  openLabel,
  position,
}: {
  readonly url: string;
  readonly openLabel: string;
  readonly position: { readonly x: number; readonly y: number };
}): Promise<void> {
  const api = readLocalApi();
  if (!api) return;
  let action: PullRequestLinkContextMenuAction | null = null;
  try {
    action = await api.contextMenu.show(pullRequestLinkContextMenuItems(openLabel), position);
  } catch {
    return;
  }
  try {
    if (action === "copy-link") await writeTextToClipboard(url, "link");
    else if (action === "open-external") await api.shell.openExternal(url);
  } catch {
    toastManager.add({
      type: "error",
      title:
        action === "copy-link"
          ? currentTranslator()("pullRequest.couldNotCopyLink")
          : currentTranslator()("pullRequest.couldNotOpenLink"),
    });
  }
}
