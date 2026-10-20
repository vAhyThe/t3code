import { settlePromise } from "@t3tools/client-runtime/state/runtime";
import { useState } from "react";

import { useT } from "../../i18n/I18nProvider";
import {
  hasDesktopNotifications,
  hasNotificationSound,
  unlockNotificationAudio,
} from "../../threadNotifications";
import { Select, SelectItem, SelectPopup, SelectTrigger, SelectValue } from "../ui/select";
import { SettingsRow } from "./settingsLayout";
import { searchableSetting } from "./settingsSearch";
import { useScopedSettings, useUpdateScopedSettings } from "./useScopedSettings";

const NOTIFICATION_MODE_KEYS = {
  off: "settingsB.notificationModeOff",
  notifications: "settingsB.notificationModeNotifications",
  sound: "settingsB.notificationModeSound",
  "notifications-and-sound": "settingsB.notificationModeNotificationsAndSound",
} as const;

export function NotificationSettings() {
  const mode = useScopedSettings((settings) => settings.notificationMode);
  const updateSettings = useUpdateScopedSettings();
  const [permissionMessage, setPermissionMessage] = useState<string | null>(null);
  const [requesting, setRequesting] = useState(false);
  const t = useT();

  return (
    <SettingsRow
      {...searchableSetting("thread-notifications")}
      description={permissionMessage ?? t("settingsB.notificationDescription")}
      control={
        <Select
          value={mode}
          disabled={requesting}
          onValueChange={async (value) => {
            if (
              value !== "off" &&
              value !== "notifications" &&
              value !== "sound" &&
              value !== "notifications-and-sound"
            )
              return;
            setPermissionMessage(null);
            if (hasNotificationSound(value)) unlockNotificationAudio();
            if (hasDesktopNotifications(value)) {
              if (typeof Notification === "undefined" || !window.isSecureContext) {
                setPermissionMessage(t("settingsB.notificationNeedsSupport"));
                return;
              }
              setRequesting(true);
              const permission = await settlePromise(() => Notification.requestPermission());
              setRequesting(false);
              if (permission._tag === "Failure") {
                setPermissionMessage(t("settingsB.notificationUnavailable"));
                return;
              }
              if (permission.value !== "granted") {
                setPermissionMessage(t("settingsB.notificationAllowPermission"));
                return;
              }
            }
            updateSettings({ notificationMode: value });
          }}
        >
          <SelectTrigger
            size="sm"
            className="w-full sm:w-56"
            aria-label={t("settingsB.notificationAria")}
          >
            <SelectValue>{t(NOTIFICATION_MODE_KEYS[mode])}</SelectValue>
          </SelectTrigger>
          <SelectPopup align="end" alignItemWithTrigger={false}>
            {Object.entries(NOTIFICATION_MODE_KEYS).map(([value, labelKey]) => (
              <SelectItem key={value} hideIndicator value={value}>
                {t(labelKey)}
              </SelectItem>
            ))}
          </SelectPopup>
        </Select>
      }
    />
  );
}
