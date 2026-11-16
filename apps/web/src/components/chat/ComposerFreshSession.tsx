import { EraserIcon } from "lucide-react";

import { currentTranslator } from "~/i18n/I18nProvider";
import type { ComposerBannerStackItem } from "./ComposerBannerStack";

/** Shown while `/clear` is armed; dismissing it keeps the current conversation. */
export function freshSessionBannerItem(onUndo: () => void): ComposerBannerStackItem {
  return {
    id: "fresh-session",
    variant: "info",
    icon: <EraserIcon />,
    title: currentTranslator()("chat.freshSessionTitle"),
    description: currentTranslator()("chat.freshSessionDescription"),
    dismissLabel: currentTranslator()("chat.freshSessionKeep"),
    onDismiss: onUndo,
  };
}
