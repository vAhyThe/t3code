import type { UiLocale } from "./locales.ts";

// Intl has no "just now" (numeric "auto" gives "now"), so the one phrase
// it lacks lives here, keyed by locale so a new locale cannot skip it.
const JUST_NOW: Record<UiLocale, string> = {
  en: "just now",
  cs: "právě teď",
};

const formatters = new Map<UiLocale, Intl.RelativeTimeFormat>();

function formatter(locale: UiLocale): Intl.RelativeTimeFormat {
  let format = formatters.get(locale);
  if (!format) {
    // Narrow matches the compact "5m ago" the UI used before localization.
    format = new Intl.RelativeTimeFormat(locale, { numeric: "always", style: "narrow" });
    formatters.set(locale, format);
  }
  return format;
}

/** "5m ago" style label for a past instant; under a minute, or in the future, is "just now". */
export function formatRelativeTime(from: Date, now: Date, locale: UiLocale): string {
  const seconds = Math.floor((now.getTime() - from.getTime()) / 1000);
  if (seconds < 60) return JUST_NOW[locale];
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return formatter(locale).format(-minutes, "minute");
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return formatter(locale).format(-hours, "hour");
  return formatter(locale).format(-Math.floor(hours / 24), "day");
}
