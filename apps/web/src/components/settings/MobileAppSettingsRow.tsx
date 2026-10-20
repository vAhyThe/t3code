import { useT } from "~/i18n/I18nProvider";
import { AndroidIcon, AppleIcon } from "../Icons";
import { Button } from "../ui/button";
import { Popover, PopoverPopup, PopoverTitle, PopoverTrigger } from "../ui/popover";
import { QRCodeSvg } from "../ui/qr-code";
import { SettingsRow } from "./settingsLayout";
import { searchableSetting } from "./settingsSearch";

const stores = [
  {
    labelKey: "settingsD.mobileAppIosLabel",
    store: "App Store", // i18n-ignore: store brand name
    url: "https://apps.apple.com/us/app/t3-code-remote-claude-more/id6787819824",
    Icon: AppleIcon,
  },
  {
    labelKey: "shellRest.androidPlatformName",
    store: "Google Play", // i18n-ignore: store brand name
    url: "https://play.google.com/store/apps/details?id=com.t3tools.t3code",
    Icon: AndroidIcon,
  },
] as const;

export function MobileAppSettingsRow() {
  const t = useT();
  return (
    <SettingsRow
      {...searchableSetting("mobile-app")}
      description={t("settingsD.mobileAppDescription")}
      control={
        <div className="flex items-center gap-2">
          {stores.map(({ labelKey, store, url, Icon }) => (
            <Popover key={store}>
              <PopoverTrigger render={<Button size="sm" variant="outline" />}>
                <Icon />
                {t(labelKey)}
              </PopoverTrigger>
              <PopoverPopup align="end">
                <div className="flex flex-col items-center gap-3">
                  <PopoverTitle>{store}</PopoverTitle>
                  <p className="text-xs text-muted-foreground">
                    {t("settingsD.mobileAppScanWithCamera")}
                  </p>
                  <div className="rounded-lg bg-white p-1.5">
                    <QRCodeSvg
                      value={url}
                      size={128}
                      level="M"
                      marginSize={1}
                      title={t("settingsD.mobileAppStoreLink", { store })}
                    />
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    render={<a href={url} target="_blank" rel="noreferrer noopener" />}
                  >
                    {t("settingsD.mobileAppOpenStore", { store })}
                  </Button>
                </div>
              </PopoverPopup>
            </Popover>
          ))}
        </div>
      }
    />
  );
}
