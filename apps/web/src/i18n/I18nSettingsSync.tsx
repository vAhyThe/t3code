import type { ClientSettings } from "@t3tools/contracts";
import { type ReactNode, useLayoutEffect } from "react";

import { useClientSettings, useClientSettingsHydrated } from "../hooks/useSettings";
import { localeStore } from "./I18nProvider";

const selectInterfaceLanguage = (settings: ClientSettings) => settings.interfaceLanguage;

/** Follows the interfaceLanguage client setting once settings hydrate. */
export function I18nSettingsSync({ children }: { readonly children: ReactNode }) {
  const hydrated = useClientSettingsHydrated();
  const preference = useClientSettings(selectInterfaceLanguage);
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- Keeps the external locale store in step with the persisted interfaceLanguage setting before paint.
  useLayoutEffect(() => {
    localeStore.sync({ hydrated, preference });
  }, [hydrated, preference]);
  return children;
}
