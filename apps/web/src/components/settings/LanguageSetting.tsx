import type { ClientSettings, InterfaceLanguage } from "@t3tools/contracts";
import { DEFAULT_CLIENT_SETTINGS } from "@t3tools/contracts";

import { useT } from "../../i18n/I18nProvider";
import { Select, SelectItem, SelectPopup, SelectTrigger, SelectValue } from "../ui/select";
import { SettingResetButton, SettingsRow } from "./settingsLayout";
import { searchableSetting } from "./settingsSearch";
import { useScopedSettings, useUpdateScopedSettings } from "./useScopedSettings";

// Language names stay in their own language, so a user can find theirs
// whatever the interface currently shows.
const LANGUAGE_NAMES = {
  en: "English", // i18n-ignore: endonym
  cs: "Čeština", // i18n-ignore: endonym
} as const;

const selectInterfaceLanguage = (settings: ClientSettings) => settings.interfaceLanguage;

function isInterfaceLanguage(value: unknown): value is InterfaceLanguage {
  return value === "system" || value === "en" || value === "cs";
}

export function LanguageSetting() {
  const t = useT();
  const language = useScopedSettings(selectInterfaceLanguage);
  const updateSettings = useUpdateScopedSettings();
  const labels: Record<InterfaceLanguage, string> = {
    system: t("settingsA.languageSystem"),
    ...LANGUAGE_NAMES,
  };

  return (
    <SettingsRow
      {...searchableSetting("interface-language")}
      title={t("settingsA.language")}
      description={t("settingsA.languageDescription")}
      resetAction={
        language !== DEFAULT_CLIENT_SETTINGS.interfaceLanguage ? (
          <SettingResetButton
            label={t("settingsA.languageResetLabel")}
            onClick={() =>
              updateSettings({ interfaceLanguage: DEFAULT_CLIENT_SETTINGS.interfaceLanguage })
            }
          />
        ) : null
      }
      control={
        <Select
          value={language}
          onValueChange={(value) => {
            if (isInterfaceLanguage(value)) updateSettings({ interfaceLanguage: value });
          }}
        >
          <SelectTrigger size="sm" className="w-full sm:w-40" aria-label={t("settingsA.language")}>
            <SelectValue>{labels[language]}</SelectValue>
          </SelectTrigger>
          <SelectPopup align="end" alignItemWithTrigger={false}>
            {(["system", "en", "cs"] as const).map((value) => (
              <SelectItem key={value} hideIndicator value={value}>
                {labels[value]}
              </SelectItem>
            ))}
          </SelectPopup>
        </Select>
      }
    />
  );
}
