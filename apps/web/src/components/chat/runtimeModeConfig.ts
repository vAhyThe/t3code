import type { RuntimeMode } from "@t3tools/contracts";
import type { MessageKey } from "@t3tools/client-runtime/i18n";
import { type LucideIcon, LockIcon, LockOpenIcon, PenLineIcon, SparklesIcon } from "lucide-react";

// Keys, not text: render with `t(labelKey)` so the label follows the UI language.
export const runtimeModeConfig: Record<
  RuntimeMode,
  { labelKey: MessageKey; descriptionKey: MessageKey; icon: LucideIcon }
> = {
  "approval-required": {
    labelKey: "chat.runtimeModeSupervisedLabel",
    descriptionKey: "chat.runtimeModeSupervisedDescription",
    icon: LockIcon,
  },
  "auto-accept-edits": {
    labelKey: "chat.runtimeModeAutoAcceptEditsLabel",
    descriptionKey: "chat.runtimeModeAutoAcceptEditsDescription",
    icon: PenLineIcon,
  },
  auto: {
    labelKey: "chat.runtimeModeAutoLabel",
    descriptionKey: "chat.runtimeModeAutoDescription",
    icon: SparklesIcon,
  },
  "full-access": {
    labelKey: "chat.runtimeModeFullAccessLabel",
    descriptionKey: "chat.runtimeModeFullAccessDescription",
    icon: LockOpenIcon,
  },
};

export const runtimeModeOptions = Object.keys(runtimeModeConfig) as RuntimeMode[];
