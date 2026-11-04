import type { MessageKey } from "@t3tools/client-runtime/i18n";
import {
  managedRuntimeModeDenial,
  type ManagedPolicySummary,
  type RuntimeMode,
} from "@t3tools/contracts";
import { type LucideIcon, LockIcon, PenLineIcon, ShieldOffIcon, SparklesIcon } from "lucide-react";

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
    // An open lock reads like a closed one at small sizes; a crossed shield does not.
    icon: ShieldOffIcon,
  },
};

export const runtimeModeOptions = Object.keys(runtimeModeConfig) as RuntimeMode[];

/** The modes a provider supports (all when it reports none) and the mode a thread really runs in. */
export function resolveCompatibleRuntimeMode(
  runtimeMode: RuntimeMode,
  supportedRuntimeModes: ReadonlyArray<RuntimeMode> | undefined,
) {
  const modes =
    supportedRuntimeModes && supportedRuntimeModes.length > 0
      ? runtimeModeOptions.filter((mode) => supportedRuntimeModes.includes(mode))
      : runtimeModeOptions;
  return { modes, mode: modes.includes(runtimeMode) ? runtimeMode : (modes[0] ?? runtimeMode) };
}

export function resolveRuntimeModeOptions(
  modes: ReadonlyArray<RuntimeMode>,
  managedPolicy: ManagedPolicySummary | undefined,
) {
  return modes.map((mode) => {
    const option = { mode, ...runtimeModeConfig[mode] };
    const disabledReason = managedRuntimeModeDenial(managedPolicy, mode);
    return disabledReason === undefined ? option : { ...option, disabledReason };
  });
}
