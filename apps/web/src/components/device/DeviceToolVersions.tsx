import type { ReactNode } from "react";
import type { DeviceToolVersions as ToolVersions } from "@t3tools/contracts";
import { InlineButton } from "~/components/ui/button";
import { Popover, PopoverPopup, PopoverTitle, PopoverTrigger } from "~/components/ui/popover";
import { useT } from "~/i18n/I18nProvider";

export function DeviceToolVersions({
  tools,
  action,
  kind,
  owner,
  error,
}: {
  tools: ToolVersions | undefined;
  action?: ReactNode;
  kind?: keyof ToolVersions;
  owner?: string | undefined;
  error?: string | undefined;
}) {
  const t = useT();
  const selected = kind ? tools?.[kind] : undefined;
  const version =
    selected?.runningVersion ??
    (selected?.installedVersions.includes(selected.requiredVersion)
      ? selected.requiredVersion
      : selected?.installedVersions
          .toSorted((a, b) => a.localeCompare(b, undefined, { numeric: true }))
          .at(-1));
  const label = kind === "hub" ? t("shellDevice.deviceToolHub") : t("shellDevice.deviceToolAgent");
  return (
    <Popover>
      <PopoverTrigger
        aria-label={
          kind
            ? t("shellDevice.deviceToolAriaLabel", {
                label,
                status: version
                  ? t("shellDevice.deviceVersionValue", { version })
                  : selected
                    ? t("shellDevice.deviceNotInstalledLower")
                    : t("shellDevice.deviceVersionUnknownLower"),
              })
            : undefined
        }
        render={<InlineButton tone="muted" />}
      >
        {kind
          ? version
            ? `v${version}`
            : selected
              ? t("shellDevice.deviceNotInstalled")
              : t("shellDevice.deviceVersionUnknown")
          : error
            ? t("shellDevice.deviceVersionsUnavailable")
            : t("shellDevice.deviceVersions")}
      </PopoverTrigger>
      <PopoverPopup align="end" width="md">
        <PopoverTitle>{kind ? label : t("shellDevice.deviceToolsTitle")}</PopoverTitle>
        {tools ? (
          <div className="mt-4 divide-y divide-border/50">
            {(
              [
                ["hub", t("shellDevice.deviceToolHub"), tools.hub],
                ["agent", t("shellDevice.deviceToolAgent"), tools.agent],
              ] as const
            )
              .filter(([id]) => !kind || id === kind)
              .map(([id, name, tool]) => (
                <div key={id} className="space-y-2 py-3 first:pt-0 last:pb-0">
                  {!kind ? <p className="text-xs font-medium">{name}</p> : null}
                  <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-1 text-xs">
                    <dt className="text-muted-foreground">{t("shellDevice.deviceToolRunning")}</dt>
                    <dd className="text-right font-mono">
                      {tool.runningVersion ?? t("shellDevice.deviceToolNotRunning")}
                    </dd>
                    <dt className="text-muted-foreground">{t("shellDevice.deviceToolRequired")}</dt>
                    <dd className="text-right font-mono">{tool.requiredVersion}</dd>
                    <dt className="text-muted-foreground">
                      {t("shellDevice.deviceToolInstalled")}
                    </dt>
                    <dd className="text-right font-mono break-words">
                      {tool.installedVersions.join(", ") || t("shellDevice.deviceToolNone")}
                    </dd>
                  </dl>
                </div>
              ))}
          </div>
        ) : (
          <p className="mt-3 text-xs text-muted-foreground">
            {t("shellDevice.deviceVersionsNotChecked")}
          </p>
        )}
        <p className="mt-4 border-t border-border/50 pt-3 text-xs text-muted-foreground">
          {owner
            ? t("shellDevice.deviceToolsManagedBy", { owner })
            : t("shellDevice.deviceToolsAutoUpdate")}
        </p>
        {error ? (
          <p role="status" className="mt-2 text-xs text-destructive">
            {error}
          </p>
        ) : null}
        {action ? <div className="mt-3">{action}</div> : null}
      </PopoverPopup>
    </Popover>
  );
}
