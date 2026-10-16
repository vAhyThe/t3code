import type { InterfaceLanguage } from "@t3tools/contracts";
import { resolveUiLocale, SUPPORTED_UI_LOCALES, type UiLocale } from "@t3tools/client-runtime/i18n";

/**
 * Last resolved locale. Desktop hydrates client settings over IPC after the
 * first paint, so startup reads this synchronously instead of flashing English.
 */
export const UI_LOCALE_STORAGE_KEY = "t3code:ui-locale";

type LocaleCache = {
  getItem: (name: string) => string | null | Promise<string | null>;
  setItem: (name: string, value: string) => unknown;
};

/**
 * The desktop host reports the OS locale first because Chromium in the
 * packaged app ships only en-US and pins navigator.languages to it.
 */
export function uiSystemLanguages(
  hostLocale: string | null | undefined,
  navigatorLanguages: readonly string[],
): string[] {
  const host = hostLocale?.trim().replace(/_/g, "-");
  return host ? [host, ...navigatorLanguages] : [...navigatorLanguages];
}

function readCachedLocale(storage: LocaleCache | null): UiLocale | null {
  try {
    const cached = storage?.getItem(UI_LOCALE_STORAGE_KEY);
    return typeof cached === "string" &&
      (SUPPORTED_UI_LOCALES as readonly string[]).includes(cached)
      ? (cached as UiLocale)
      : null;
  } catch {
    return null;
  }
}

export function createUiLocaleStore(options: {
  readonly storage: LocaleCache | null;
  readonly systemLanguages: readonly string[];
}) {
  const listeners = new Set<() => void>();
  let locale =
    readCachedLocale(options.storage) ?? resolveUiLocale("system", options.systemLanguages);

  return {
    getLocale: (): UiLocale => locale,
    subscribe(listener: () => void): () => void {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    /** Before hydration the settings are schema defaults, so the cache stays authoritative. */
    sync(state: { readonly hydrated: boolean; readonly preference: InterfaceLanguage }): void {
      if (!state.hydrated) return;
      const next = resolveUiLocale(state.preference, options.systemLanguages);
      if (next === locale) return;
      locale = next;
      try {
        options.storage?.setItem(UI_LOCALE_STORAGE_KEY, next);
      } catch {
        // A blocked cache only costs a flash of the old language on next start.
      }
      for (const listener of listeners) listener();
    },
  };
}
