import type { ClientSettings } from "@t3tools/contracts";
import { formatMoney } from "@t3tools/shared/usageFormat";

import { useUsdCzkRate } from "../state/usdCzkRate";
import { useClientSettings } from "./useSettings";

const selectDisplayCurrency = (settings: ClientSettings) => settings.displayCurrency;

/** The rate to show USD amounts in CZK, or null to keep USD. */
export function useDisplayCzkPerUsd(): number | null {
  const rate = useUsdCzkRate(useClientSettings(selectDisplayCurrency) === "CZK");
  return rate?.czkPerUsd ?? null;
}

/** Formats a USD amount in the display currency, falling back to USD while no rate is known. */
export function useFormatMoney(): (usd: number) => string {
  const czkPerUsd = useDisplayCzkPerUsd();
  return (usd: number) => formatMoney(usd, czkPerUsd);
}
