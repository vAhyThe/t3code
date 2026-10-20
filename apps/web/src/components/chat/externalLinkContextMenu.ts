import type { ContextMenuItem } from "@t3tools/contracts";
import type { MessageKey } from "@t3tools/client-runtime/i18n";

import { currentTranslator } from "~/i18n/I18nProvider";

export type ExternalLinkContextMenuAction =
  | "open-in-preview"
  | "open-external"
  | "copy-link"
  | "link-to-thread"
  | "unlink-from-thread";

export type ExternalLinkContextMenuFailureOperation =
  | "show-link-context-menu"
  | "open-link-in-preview"
  | "open-link-external"
  | "copy-link"
  | "link-pull-request-to-thread"
  | "unlink-pull-request-from-thread";

const FAILURE_OPERATION_BY_ACTION = {
  "open-in-preview": "open-link-in-preview",
  "open-external": "open-link-external",
  "copy-link": "copy-link",
  "link-to-thread": "link-pull-request-to-thread",
  "unlink-from-thread": "unlink-pull-request-from-thread",
} as const satisfies Record<ExternalLinkContextMenuAction, ExternalLinkContextMenuFailureOperation>;

const EXTERNAL_LINK_CONTEXT_MENU_ITEMS = [
  { id: "open-in-preview", labelKey: "chat.linkMenuOpenInPreview" },
  { id: "open-external", labelKey: "chat.linkMenuOpenExternal" },
  { id: "copy-link", labelKey: "chat.linkMenuCopyLink" },
] as const satisfies readonly {
  readonly id: ExternalLinkContextMenuAction;
  readonly labelKey: MessageKey;
}[];

function externalLinkContextMenuItems(options: {
  readonly canOpenInPreview: boolean;
  readonly threadLinkAction?: "link-to-thread" | "unlink-from-thread" | undefined;
}): readonly ContextMenuItem<ExternalLinkContextMenuAction>[] {
  const t = currentTranslator();
  const entries = options.canOpenInPreview
    ? EXTERNAL_LINK_CONTEXT_MENU_ITEMS
    : EXTERNAL_LINK_CONTEXT_MENU_ITEMS.filter((item) => item.id !== "open-in-preview");
  const items = entries.map((item) => ({ id: item.id, label: t(item.labelKey) }));
  if (options.threadLinkAction === undefined) return items;
  return [
    {
      id: options.threadLinkAction,
      label: t(
        options.threadLinkAction === "link-to-thread"
          ? "chat.linkMenuLinkToThread"
          : "chat.linkMenuUnlinkFromThread",
      ),
    },
    ...items,
  ];
}

interface ShowExternalLinkContextMenuOptions {
  readonly href: string;
  readonly position: { readonly x: number; readonly y: number };
  readonly canOpenInPreview?: boolean;
  readonly threadLinkAction?: "link-to-thread" | "unlink-from-thread" | undefined;
  readonly showContextMenu: (
    items: readonly ContextMenuItem<ExternalLinkContextMenuAction>[],
    position: { readonly x: number; readonly y: number },
  ) => Promise<ExternalLinkContextMenuAction | null>;
  readonly openInPreview: (href: string) => Promise<void>;
  readonly openExternal: (href: string) => Promise<void>;
  readonly copyLink: (href: string) => Promise<unknown>;
  readonly updateThreadLink?: (href: string, linked: boolean) => Promise<void>;
  readonly reportFailure: (
    operation: ExternalLinkContextMenuFailureOperation,
    cause: unknown,
  ) => void;
}

function resolveExternalWebLink(href: string | null | undefined): URL | null {
  if (!href) return null;
  try {
    const url = new URL(href.startsWith("//") ? `https:${href}` : href);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return url;
  } catch {
    return null;
  }
}

export function resolveExternalWebLinkHref(href: string | null | undefined): string | null {
  return resolveExternalWebLink(href)?.href ?? null;
}

export function resolveExternalWebLinkHost(href: string | undefined): string | null {
  return resolveExternalWebLink(href)?.hostname || null;
}

export async function showExternalLinkContextMenu({
  href,
  position,
  canOpenInPreview = true,
  threadLinkAction,
  showContextMenu,
  openInPreview,
  openExternal,
  copyLink,
  updateThreadLink,
  reportFailure,
}: ShowExternalLinkContextMenuOptions): Promise<void> {
  let action: ExternalLinkContextMenuAction | null;
  try {
    action = await showContextMenu(
      externalLinkContextMenuItems({ canOpenInPreview, threadLinkAction }),
      position,
    );
  } catch (cause) {
    reportFailure("show-link-context-menu", cause);
    return;
  }

  try {
    if (action === "open-in-preview") {
      await openInPreview(href);
    } else if (action === "open-external") {
      await openExternal(href);
    } else if (action === "copy-link") {
      await copyLink(href);
    } else if (action === "link-to-thread" || action === "unlink-from-thread") {
      await updateThreadLink?.(href, action === "link-to-thread");
    }
  } catch (cause) {
    if (action) reportFailure(FAILURE_OPERATION_BY_ACTION[action], cause);
  }
}
