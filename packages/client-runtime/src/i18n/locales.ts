import { InterfaceLanguage } from "@t3tools/contracts";

export type UiLocale = Exclude<InterfaceLanguage, "system">;

export const SUPPORTED_UI_LOCALES: readonly UiLocale[] = InterfaceLanguage.literals.filter(
  (language): language is UiLocale => language !== "system",
);

const DEFAULT_UI_LOCALE: UiLocale = "en";

function isUiLocale(value: string): value is UiLocale {
  return (SUPPORTED_UI_LOCALES as readonly string[]).includes(value);
}

/**
 * Resolves the language the UI renders in. `systemLanguages` is in the user's
 * preference order (navigator.languages, Electron's preferred languages), so
 * the first supported entry wins rather than the best match overall.
 */
export function resolveUiLocale(
  preference: InterfaceLanguage,
  systemLanguages: readonly string[],
): UiLocale {
  if (preference !== "system") return preference;
  for (const tag of systemLanguages) {
    const language = tag.split(/[-_]/)[0]?.toLowerCase() ?? "";
    if (isUiLocale(language)) return language;
  }
  return DEFAULT_UI_LOCALE;
}
