import type { KeybindingCommand, ResolvedKeybindingsConfig } from "@t3tools/contracts";
import type { UsageChartMetric } from "./UsageProviderChart";
import { resolveShortcutCommand, type ShortcutEventLike } from "../../keybindings";

export type UsageMetric = UsageChartMetric | "limits";
export const METRIC_OPTIONS = [
  { value: "cost", labelKey: "shellDevice.usageMetricCost", command: "usage.cost" },
  { value: "tokens", labelKey: "shellDevice.usageMetricTokens", command: "usage.tokens" },
  { value: "limits", labelKey: "shellDevice.usageMetricLimits", command: "usage.limits" },
] as const satisfies readonly {
  value: UsageMetric;
  labelKey: string;
  command: KeybindingCommand;
}[];

export const WINDOW_OPTIONS = [
  { days: 1, labelKey: "shellDevice.usageWindowPast24h", command: "usage.period.day" },
  { days: 7, labelKey: "shellDevice.usageWindow7Days", command: "usage.period.week" },
  { days: 30, labelKey: "shellDevice.usageWindow30Days", command: "usage.period.month" },
  { days: 90, labelKey: "shellDevice.usageWindow90Days", command: "usage.period.quarter" },
] as const;

/** Resolves page shortcuts without taking letters from fields or popup controls. */
export function resolveUsageShortcut(
  event: ShortcutEventLike & { target: EventTarget | null },
  keybindings: ResolvedKeybindingsConfig,
) {
  const target = event.target;
  if (
    target instanceof HTMLElement &&
    (target.tagName === "INPUT" ||
      target.tagName === "TEXTAREA" ||
      target.tagName === "SELECT" ||
      target.isContentEditable ||
      target.closest('[role="dialog"], [aria-modal="true"], [data-slot$="popup"]'))
  ) {
    return null;
  }

  return resolveShortcutCommand(event, keybindings, {
    context: { usagePageOpen: true },
  });
}
