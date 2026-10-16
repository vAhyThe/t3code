import type { ClientSettings } from "@t3tools/contracts";
import { type ReactNode, useLayoutEffect } from "react";

import { useClientSettings, useClientSettingsHydrated } from "../hooks/useSettings";
import { localeStore } from "./I18nProvider";

const selectInterfaceLanguage = (settings: ClientSettings) => settings.interfaceLanguage;

/** Follows the interfaceLanguage client setting once settings hydrate. */
export function I18nSettingsSync({ children }: { readonly children: ReactNode }) {
  const hydrated = useClientSettingsHydrated();
  const preference = useClientSettings(selectInterfaceLanguage);
  // Layout effect so a language change re-renders before paint.
  useLayoutEffect(() => {
    localeStore.sync({ hydrated, preference });
  }, [hydrated, preference]);
  return children;
}
