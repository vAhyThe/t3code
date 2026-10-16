import { useAtomValue } from "@effect/atom-react";

import { undoLatestThreadAction, useThreadUndoNotice } from "../../hooks/showThreadUndoNotice";
import { shortcutLabelForCommand } from "../../keybindings";
import type { MessageKey } from "@t3tools/client-runtime/i18n";

import { useT } from "../../i18n/I18nProvider";
import { primaryServerKeybindingsAtom } from "../../state/server";
import { Alert, AlertDescription } from "../ui/alert";
import { InlineButton } from "../ui/button";

const UNDO_NOTICE_KEYS: Record<
  "Settled" | "Snoozed" | "Unpinned" | "Archived" | "Discarded",
  MessageKey
> = {
  Settled: "shellNav.undoSettled",
  Snoozed: "shellNav.undoSnoozed",
  Unpinned: "shellNav.undoUnpinned",
  Archived: "shellNav.undoArchived",
  Discarded: "shellNav.undoDiscarded",
};

export function SidebarThreadUndoNotice() {
  const t = useT();
  const notice = useThreadUndoNotice((state) => state.notice);
  const keybindings = useAtomValue(primaryServerKeybindingsAtom);

  if (!notice) return null;
  const shortcut = shortcutLabelForCommand(keybindings, "thread.undo");

  return (
    <Alert role="status" variant="sidebar">
      <AlertDescription>
        {t(UNDO_NOTICE_KEYS[notice.action], { count: notice.count })}{" "}
        <InlineButton onClick={undoLatestThreadAction}>
          {shortcut ? t("shellNav.undoWithShortcut", { shortcut }) : t("shellNav.undo")}
        </InlineButton>
      </AlertDescription>
    </Alert>
  );
}
