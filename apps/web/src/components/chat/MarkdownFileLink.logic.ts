import { currentTranslator } from "~/i18n/I18nProvider";
import type { EnvironmentId } from "@t3tools/contracts";
import { splitFilePathPosition } from "@t3tools/shared/fileLinks";

import {
  shouldOpenMarkdownFileLinkInBrowserByDefault,
  type MarkdownFileLinkMeta,
} from "../../markdown-links";
import type { RemoteOpenMode } from "../../remoteOpen";

export function canUseMarkdownFileShellActions(
  environmentId: EnvironmentId | null,
  remoteOpenMode: RemoteOpenMode,
  isRemoteOpenResolved: boolean,
): boolean {
  return environmentId !== null && isRemoteOpenResolved && remoteOpenMode === "local-exec";
}

export function hasMarkdownFilePrimaryAction(input: {
  canOpenInEditor: boolean;
  canOpenInBrowser: boolean;
  canOpenInPanel: boolean;
  canOpenMedia?: boolean;
}): boolean {
  return (
    input.canOpenInEditor ||
    input.canOpenInBrowser ||
    input.canOpenInPanel ||
    input.canOpenMedia === true
  );
}

export function markdownFileCopyMenuItems({
  targetPath,
  workspaceRelativePath,
}: Pick<MarkdownFileLinkMeta, "targetPath" | "workspaceRelativePath">) {
  const items = [
    {
      id: "copy-full",
      label: currentTranslator()("chat.markdownCopyFullPath"),
      value: targetPath,
      title: currentTranslator()("chat.markdownFullPath"),
    },
  ];
  if (workspaceRelativePath !== null) {
    const position = targetPath.slice(splitFilePathPosition(targetPath).path.length);
    items.unshift({
      id: "copy-relative",
      label: currentTranslator()("chat.markdownCopyRelativePath"),
      value: `${workspaceRelativePath}${position}`,
      title: currentTranslator()("chat.markdownRelativePath"),
    });
  }
  return items;
}

export function shouldUseMarkdownFileBrowserPrimaryAction(input: {
  iconPath: string;
  canOpenInEditor: boolean;
  canOpenInBrowser: boolean;
  canOpenInPanel: boolean;
}): boolean {
  return (
    input.canOpenInBrowser &&
    (shouldOpenMarkdownFileLinkInBrowserByDefault(input.iconPath) ||
      (!input.canOpenInEditor && !input.canOpenInPanel))
  );
}
