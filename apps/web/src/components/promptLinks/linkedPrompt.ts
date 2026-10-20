import type { LinkedPrompt } from "@t3tools/shared/promptLinks";

import { type ComposerThreadTarget, useComposerDraftStore } from "~/composerDraftStore";
import { currentTranslator } from "~/i18n/I18nProvider";

import { toastManager } from "../ui/toast";

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

export function placeLinkedPrompt(
  target: ComposerThreadTarget,
  prompt: LinkedPrompt,
  notes: ReadonlyArray<string> = [],
): void {
  warnAboutHiddenCharacters(prompt);
  const t = currentTranslator();
  const place = () => {
    useComposerDraftStore.getState().setPrompt(target, prompt.text);
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
