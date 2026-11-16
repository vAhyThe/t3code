import type { ReactNode } from "react";

import { Trans } from "~/i18n/Trans";
import { useT } from "~/i18n/I18nProvider";
import { cn } from "~/lib/utils";

import { CommandBlock } from "./CommandBlock";

/**
 * Setup steps for another computer: install `t3`, then run `command`. Both installers are shown
 * because the browser showing this is often not the computer being set up.
 */
export function InstallT3Commands({
  command,
  className,
}: {
  readonly command: string;
  readonly className?: string;
}) {
  const t = useT();
  return (
    <div className={cn("space-y-2", className)}>
      <p className="text-xs text-muted-foreground">macOS, Linux</p>
      <CommandBlock command="curl -fsSL https://t3.codes/install.sh | sh" />
      <p className="text-xs text-muted-foreground">{t("onboarding.installWindows")}</p>
      <CommandBlock command="irm https://t3.codes/install.ps1 | iex" />
      <p className="text-xs text-muted-foreground">{t("onboarding.installThen")}</p>
      <CommandBlock command={command} />
      <p className="text-xs text-muted-foreground">
        <Trans
          k="onboarding.installSkip"
          components={{
            // oxlint-disable-next-line react/no-unstable-nested-components -- Trans invokes this render callback directly.
            code: (children: ReactNode) => <code className="font-mono">{children}</code>,
          }}
        />
      </p>
    </div>
  );
}
