import type { ClientSettings, DisplayCurrency, UsdCzkRate } from "@t3tools/contracts";
import { DEFAULT_CLIENT_SETTINGS } from "@t3tools/contracts";
import type { Translate } from "@t3tools/client-runtime/i18n";

import { useT, useUiLocale } from "../../i18n/I18nProvider";
import { useUsdCzkRate } from "../../state/usdCzkRate";
import { Select, SelectItem, SelectPopup, SelectTrigger, SelectValue } from "../ui/select";
import { SettingResetButton, SettingsRow } from "./settingsLayout";
import { searchableSetting } from "./settingsSearch";
import { useScopedSettings, useUpdateScopedSettings } from "./useScopedSettings";

const CURRENCY_LABELS: Record<DisplayCurrency, string> = {
  USD: "USD ($)", // i18n-ignore: currency code and symbol
  CZK: "CZK (Kč)", // i18n-ignore: currency code and symbol
};

const selectDisplayCurrency = (settings: ClientSettings) => settings.displayCurrency;

function isDisplayCurrency(value: unknown): value is DisplayCurrency {
  return value === "USD" || value === "CZK";
}

function rateDescription(t: Translate, locale: string, rate: UsdCzkRate | null): string {
  if (rate === null) return t("settingsA.displayCurrencyRateUnavailable");
  return t("settingsA.displayCurrencyRate", {
    rate: new Intl.NumberFormat(locale, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 3,
    }).format(rate.czkPerUsd),
    date: new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeZone: "UTC" }).format(
      new Date(`${rate.rateDate}T00:00:00Z`),
    ),
  });
}

export function CurrencySetting() {
  const t = useT();
  const locale = useUiLocale();
  const currency = useScopedSettings(selectDisplayCurrency);
  const updateSettings = useUpdateScopedSettings();
  const rate = useUsdCzkRate(currency === "CZK");
  const description =
    currency === "CZK"
      ? `${t("settingsA.displayCurrencyDescription")} ${rateDescription(t, locale, rate)}`
      : t("settingsA.displayCurrencyDescription");

  return (
    <SettingsRow
      {...searchableSetting("display-currency")}
      title={t("settingsA.displayCurrency")}
      description={description}
      resetAction={
        currency !== DEFAULT_CLIENT_SETTINGS.displayCurrency ? (
          <SettingResetButton
            label={t("settingsA.displayCurrencyResetLabel")}
            onClick={() =>
              updateSettings({ displayCurrency: DEFAULT_CLIENT_SETTINGS.displayCurrency })
            }
          />
        ) : null
      }
      control={
        <Select
          value={currency}
          onValueChange={(value) => {
            if (isDisplayCurrency(value)) updateSettings({ displayCurrency: value });
          }}
        >
          <SelectTrigger
            size="sm"
            className="w-full sm:w-40"
            aria-label={t("settingsA.displayCurrency")}
          >
            <SelectValue>{CURRENCY_LABELS[currency]}</SelectValue>
          </SelectTrigger>
          <SelectPopup align="end" alignItemWithTrigger={false}>
            {(["USD", "CZK"] as const).map((value) => (
              <SelectItem key={value} hideIndicator value={value}>
                {CURRENCY_LABELS[value]}
              </SelectItem>
            ))}
          </SelectPopup>
        </Select>
      }
    />
  );
}
