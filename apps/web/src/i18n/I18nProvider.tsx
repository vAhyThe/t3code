import { createTranslator, type Translate, type UiLocale } from "@t3tools/client-runtime/i18n";
import { useSyncExternalStore } from "react";

import { createUiLocaleStore, uiSystemLanguages } from "./uiLocaleStore";

function browserStorage(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

/**
 * Kept free of settings imports so any component can use the translator
 * without pulling the settings and environment state graph into its module
 * (and its tests). The settings sync lives in I18nSettingsSync.
 */
export const localeStore = createUiLocaleStore({
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
