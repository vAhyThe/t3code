import type { ServerProcessSignal } from "@t3tools/contracts";

import { useT } from "../../i18n/I18nProvider";
import { InlineButton } from "../ui/button";
import { Tooltip, TooltipPopup, TooltipTrigger } from "../ui/tooltip";

export function ProcessSignalActions({
  disabled,
  onSignal,
}: {
  disabled: boolean;
  onSignal: (signal: ServerProcessSignal) => void;
}) {
  const t = useT();
  return (
    <div className="flex items-center justify-end gap-1.5">
      <Tooltip>
        <TooltipTrigger
          render={
            <InlineButton
              disabled={disabled}
              aria-label={t("settingsB.processSignalSendInt")}
              tone="muted"
              onClick={() => onSignal("SIGINT")}
            >
              INT {/* i18n-ignore: signal abbreviation shown on the button */}
            </InlineButton>
          }
        />
        <TooltipPopup side="top">{t("settingsB.processSignalSendInt")}</TooltipPopup>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger
          render={
            <InlineButton
              disabled={disabled}
              aria-label={t("settingsB.processSignalSendKill")}
              tone="destructive"
              onClick={() => onSignal("SIGKILL")}
            >
              KILL {/* i18n-ignore: signal abbreviation shown on the button */}
            </InlineButton>
          }
        />
        <TooltipPopup side="top">{t("settingsB.processSignalSendKill")}</TooltipPopup>
      </Tooltip>
    </div>
  );
}
