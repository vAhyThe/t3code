import type { DevicePlatformAvailability } from "@t3tools/contracts";
import { Check, Minus } from "lucide-react";
import { useT } from "~/i18n/I18nProvider";
import { Tooltip, TooltipTrigger, TooltipPopup } from "../ui/tooltip";

const platformName = (platform: DevicePlatformAvailability["platform"]) =>
  platform === "ios" ? "iOS" : "Android";

export function DeviceHostAvailability({
  platforms,
}: {
  platforms: ReadonlyArray<DevicePlatformAvailability>;
}) {
  const t = useT();
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
      {platforms.map((platform) => (
        <Tooltip key={platform.platform}>
          <TooltipTrigger render={<span tabIndex={0} className="inline-flex items-center gap-1" />}>
            {platform.available ? <Check className="size-3" /> : <Minus className="size-3" />}
            {platform.available
              ? t("shellDevice.devicePlatformAvailable", {
                  platform: platformName(platform.platform),
                })
              : t("shellDevice.devicePlatformUnavailable", {
                  platform: platformName(platform.platform),
                })}
          </TooltipTrigger>
          <TooltipPopup>
            {platform.reason ??
              t("shellDevice.devicePlatformAvailable", {
                platform: platformName(platform.platform),
              })}
          </TooltipPopup>
        </Tooltip>
      ))}
    </div>
  );
}
