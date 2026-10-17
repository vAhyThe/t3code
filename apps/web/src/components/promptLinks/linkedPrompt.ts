import type { LinkedPrompt } from "@t3tools/shared/promptLinks";

import { type ComposerThreadTarget, useComposerDraftStore } from "~/composerDraftStore";
import { currentTranslator } from "~/i18n/I18nProvider";

import { toastManager } from "../ui/toast";

/** A warning that stays until dismissed when the link's prompt hid characters from the reader. */
export function warnAboutHiddenCharacters(prompt: LinkedPrompt): void {
  if (prompt.hiddenCharacters === 0) return;
  const t = currentTranslator();
  toastManager.add({
    type: "warning",
    title: t("chat.promptHiddenCharactersTitle"),
    description: t("chat.promptHiddenCharactersDescription", { count: prompt.hiddenCharacters }),
    timeout: 0,
  });
}

/**
 * Puts a linked prompt in a composer for the user to read and send. Text the user already typed
 * there is never replaced without asking: a toast offers to swap it for the linked prompt.
 * `notes` carry anything the link asked for and did not get, such as a model.
 */
export function placeLinkedPrompt(
  target: ComposerThreadTarget,
  prompt: LinkedPrompt,
  notes: ReadonlyArray<string> = [],
): void {
  warnAboutHiddenCharacters(prompt);
  const t = currentTranslator();
  const place = () => {
    useComposerDraftStore.getState().setPrompt(target, prompt.text);
    // It was not written here, so it must be read before it is sent.
    toastManager.add({
      type: "info",
      title: t("chat.promptAddedFromLink"),
      description: [t("chat.promptReadBeforeSend"), ...notes].join(" "),
    });
  };
  const existing = useComposerDraftStore.getState().getComposerDraft(target)?.prompt ?? "";
  if (existing.trim().length === 0 || existing === prompt.text) {
    place();
    return;
  }
  const id = toastManager.add({
    type: "info",
    title: t("chat.linkedPromptReady"),
    description: t("chat.linkedPromptReplaceDraftQuestion"),
    timeout: 0,
    actionProps: {
      children: t("chat.linkedPromptReplaceDraftAction"),
      onClick: () => {
        toastManager.close(id);
        place();
      },
    },
  });
}
