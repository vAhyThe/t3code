import { createTranslator, type Translate, type UiLocale } from "@t3tools/client-runtime/i18n";
import type { ClientSettings } from "@t3tools/contracts";
import { type ReactNode, useLayoutEffect, useSyncExternalStore } from "react";

import { useClientSettings, useClientSettingsHydrated } from "../hooks/useSettings";
import { createUiLocaleStore, uiSystemLanguages } from "./uiLocaleStore";

function browserStorage(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

const localeStore = createUiLocaleStore({
  storage: browserStorage(),
  systemLanguages:
    typeof window === "undefined"
      ? []
      : uiSystemLanguages(window.desktopBridge?.getSystemLocale?.(), navigator.languages),
});

function applyDocumentLanguage() {
  if (typeof document !== "undefined") document.documentElement.lang = localeStore.getLocale();
}
applyDocumentLanguage();
localeStore.subscribe(applyDocumentLanguage);

const selectInterfaceLanguage = (settings: ClientSettings) => settings.interfaceLanguage;

/** Follows the interfaceLanguage client setting once settings hydrate. */
export function I18nProvider({ children }: { readonly children: ReactNode }) {
  const hydrated = useClientSettingsHydrated();
  const preference = useClientSettings(selectInterfaceLanguage);
  // Layout effect so a language change re-renders before paint.
  useLayoutEffect(() => {
    localeStore.sync({ hydrated, preference });
  }, [hydrated, preference]);
  return children;
}

export function useUiLocale(): UiLocale {
  return useSyncExternalStore(localeStore.subscribe, localeStore.getLocale, localeStore.getLocale);
}

export function useT(): Translate {
  return createTranslator(useUiLocale());
}

/**
 * The translator for code outside React, such as toasts raised from .logic.ts
 * files. Call it when the text is shown, not at module load, so it follows a
 * language change.
 */
export function currentTranslator(): Translate {
  return createTranslator(localeStore.getLocale());
}
