import { type TimestampFormat } from "@t3tools/contracts/settings";

import { currentTranslator, localeStore } from "./i18n/I18nProvider";

function getTimestampFormatOptions(
  timestampFormat: TimestampFormat,
  includeSeconds: boolean,
): Intl.DateTimeFormatOptions {
  const baseOptions: Intl.DateTimeFormatOptions = {
    hour: "numeric",
    minute: "2-digit",
    ...(includeSeconds ? { second: "2-digit" } : {}),
  };

  if (timestampFormat === "locale") {
    return baseOptions;
  }

  return {
    ...baseOptions,
    hour12: timestampFormat === "12-hour",
  };
}

/**
 * Pick the locale to format wall-clock times in, given the locale the host
 * reports. Hosts that report nothing fall back to `undefined`, which is the
 * runtime default and the right answer in a browser.
 *
 * A host reports a locale only when it knows better than the runtime does —
 * see `getSystemLocale` on the desktop bridge for why desktop does.
 */
export function resolveTimestampLocale(
  systemLocale: string | null | undefined,
): string | undefined {
  const tag = systemLocale?.trim();
  if (!tag) return undefined;

  try {
    // Every timestamp in the UI runs through this formatter, so a tag the host
    // could not normalize falls back rather than throwing. Throws on a
    // structurally invalid tag; a well-formed tag ICU has no data for resolves
    // here and is left to ICU's own fallback.
    Intl.DateTimeFormat.supportedLocalesOf([tag]);
    return tag;
  } catch {
    return undefined;
  }
}

function readHostSystemLocale(): string | null {
  if (typeof window === "undefined") return null;
  return window.desktopBridge?.getSystemLocale?.() ?? null;
}

const timestampLocale = resolveTimestampLocale(readHostSystemLocale());

const WEEKDAY_INDEXES = [0, 1, 2, 3, 4, 5, 6] as const;
type WeekdayIndex = (typeof WEEKDAY_INDEXES)[number];

type LocaleWithWeekInfo = Intl.Locale & {
  readonly weekInfo?: { readonly firstDay: number };
  getWeekInfo?: () => { readonly firstDay: number };
};

/**
 * First weekday of a locale as a `Date#getDay` index (0 is Sunday), or
 * `undefined` when the runtime has no week data, so callers keep their own
 * default. Without a locale it reads the runtime's.
 */
export function resolveWeekStartsOn(locale: string | undefined): WeekdayIndex | undefined {
  try {
    const resolved: LocaleWithWeekInfo = new Intl.Locale(
      locale ?? Intl.DateTimeFormat().resolvedOptions().locale,
    );
    // Week info counts Monday as 1 and Sunday as 7.
    const firstDay = resolved.getWeekInfo?.().firstDay ?? resolved.weekInfo?.firstDay;
    return firstDay === undefined ? undefined : WEEKDAY_INDEXES[firstDay % 7];
  } catch {
    return undefined;
  }
}

/** Week start for calendars, from the same locale timestamps are shown in. */
export const weekStartsOn = resolveWeekStartsOn(timestampLocale);

const timestampFormatterCache = new Map<string, Intl.DateTimeFormat>();

function getTimestampFormatter(
  timestampFormat: TimestampFormat,
  includeSeconds: boolean,
): Intl.DateTimeFormat {
  const cacheKey = `${timestampFormat}:${includeSeconds ? "seconds" : "minutes"}`;
  const cachedFormatter = timestampFormatterCache.get(cacheKey);
  if (cachedFormatter) {
    return cachedFormatter;
  }

  const formatter = new Intl.DateTimeFormat(
    timestampLocale,
    getTimestampFormatOptions(timestampFormat, includeSeconds),
  );
  timestampFormatterCache.set(cacheKey, formatter);
  return formatter;
}

export function parseTimestampDate(isoDate: string): Date | null {
  const date = new Date(isoDate);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatTimestamp(isoDate: string, timestampFormat: TimestampFormat): string {
  const date = parseTimestampDate(isoDate);
  if (!date) return "";
  return getTimestampFormatter(timestampFormat, true).format(date);
}

// Deliberately not the host locale: the tooltip's ordinal suffix and
// day-before-month order below are English, so a localized month alone would
// read "4th Juni 2026". Localizing the whole label is a separate change.
const monthNameFormatter = new Intl.DateTimeFormat("en-US", { month: "long" });

function ordinalSuffix(day: number): string {
  const lastTwo = day % 100;
  if (lastTwo >= 11 && lastTwo <= 13) return "th";
  switch (day % 10) {
    case 1:
      return "st";
    case 2:
      return "nd";
    case 3:
      return "rd";
    default:
      return "th";
  }
}

/**
 * Long-form tooltip label, e.g. `12:04, 4th June`.
 * Renders the wall-clock time without seconds followed by the ordinal day and month name.
 */
export function formatChatTimestampTooltip(
  isoDate: string,
  timestampFormat: TimestampFormat,
): string {
  const date = parseTimestampDate(isoDate);
  if (!date) return "";
  const time = formatShortTimestamp(isoDate, timestampFormat);
  const day = date.getDate();
  const month = monthNameFormatter.format(date);
  const year = date.getFullYear();
  return `${time}, ${day}${ordinalSuffix(day)} ${month} ${year}`;
}

export function formatShortTimestamp(isoDate: string, timestampFormat: TimestampFormat): string {
  const date = parseTimestampDate(isoDate);
  if (!date) return "";
  return getTimestampFormatter(timestampFormat, false).format(date);
}

const numericDateFormatter = new Intl.DateTimeFormat(timestampLocale, {
  month: "numeric",
  day: "numeric",
});
const numericDateWithYearFormatter = new Intl.DateTimeFormat(timestampLocale, {
  month: "numeric",
  day: "numeric",
  year: "numeric",
});

/**
 * Chat timestamp that adds the date once the message is no longer from today:
 * today `12:34 PM`, yesterday `yesterday at 12:34 PM`, older `8/13 12:34 PM`
 * (locale digit order), with the year included once the calendar year differs.
 * Boundaries are local calendar days, not 24-hour windows.
 */
export function formatDayAwareTimestamp(
  isoDate: string,
  timestampFormat: TimestampFormat,
  nowMs: number = Date.now(),
): string {
  const date = parseTimestampDate(isoDate);
  if (!date) return "";
  const time = getTimestampFormatter(timestampFormat, false).format(date);

  const now = new Date(nowMs);
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startOfMessageDay = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  // Round so DST-shifted 23/25 hour days still count as whole days.
  const dayDiff = Math.round((startOfToday - startOfMessageDay) / 86_400_000);

  if (dayDiff <= 0) return time;
  if (dayDiff === 1) return `yesterday at ${time}`;
  const dateFormatter =
    date.getFullYear() === now.getFullYear() ? numericDateFormatter : numericDateWithYearFormatter;
  return `${dateFormatter.format(date)} ${time}`;
}

/**
 * The forward-looking counterpart of {@link formatDayAwareTimestamp} for an
 * instant that has not happened yet (a usage-limit reset): today `12:34 PM`,
 * tomorrow `tomorrow at 12:34 PM`, later `8/13 12:34 PM`.
 */
export function formatUpcomingTimestamp(
  isoDate: string,
  timestampFormat: TimestampFormat,
  nowMs: number = Date.now(),
): string {
  const date = parseTimestampDate(isoDate);
  if (!date) return "";
  const time = getTimestampFormatter(timestampFormat, false).format(date);

  const now = new Date(nowMs);
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startOfTargetDay = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  const dayDiff = Math.round((startOfTargetDay - startOfToday) / 86_400_000);

  if (dayDiff < 0) return formatDayAwareTimestamp(isoDate, timestampFormat, nowMs);
  if (dayDiff === 0) return time;
  if (dayDiff === 1) return `tomorrow at ${time}`;
  const dateFormatter =
    date.getFullYear() === now.getFullYear() ? numericDateFormatter : numericDateWithYearFormatter;
  return `${dateFormatter.format(date)} ${time}`;
}

/**
 * Format a relative time string from an ISO date.
 * Returns `{ value: "20s", suffix: "ago" }` or `{ value: "just now", suffix: null }`
 * so callers can style the numeric portion independently.
 */
type RelativeTimeParts = { value: string; suffix: string | null };
export type RelativeTimeState =
  | { status: "missing" }
  | { status: "invalid" }
  | { status: "relative"; value: string; suffix: string | null };

type RelativeUnit = "seconds" | "minutes" | "hours" | "days";

const UNIT_KEY = {
  seconds: "shellRest.unitSeconds",
  minutes: "shellRest.unitMinutes",
  hours: "shellRest.unitHours",
  days: "shellRest.unitDays",
} as const;

function durationText(count: number, unit: RelativeUnit): string {
  return currentTranslator()(UNIT_KEY[unit], { count });
}

// English keeps the number and the word apart so callers can style them. Other
// languages put the word around the whole duration, so they return the phrase
// as the value with no suffix.
function relativePhrase(
  count: number,
  unit: RelativeUnit,
  direction: "ago" | "left",
): RelativeTimeParts {
  const t = currentTranslator();
  const duration = durationText(count, unit);
  if (localeStore.getLocale() === "en") {
    return { value: duration, suffix: t(direction === "ago" ? "shellRest.ago" : "shellRest.left") };
  }
  return {
    value: t(direction === "ago" ? "shellRest.agoPhrase" : "shellRest.leftPhrase", { duration }),
    suffix: null,
  };
}

export function formatRelativeTime(isoDate: string): RelativeTimeParts | null {
  const date = parseTimestampDate(isoDate);
  if (!date) return null;
  const diffMs = Date.now() - date.getTime();
  if (diffMs < 0) return { value: currentTranslator()("shellRest.justNow"), suffix: null };
  const seconds = Math.floor(diffMs / 1000);
  if (seconds < 60) return { value: currentTranslator()("shellRest.justNow"), suffix: null };
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return relativePhrase(minutes, "minutes", "ago");
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return relativePhrase(hours, "hours", "ago");
  return relativePhrase(Math.floor(hours / 24), "days", "ago");
}

export function formatRelativeTimeLabel(isoDate: string) {
  const relative = formatRelativeTime(isoDate);
  if (!relative) return "";
  return relative.suffix ? `${relative.value} ${relative.suffix}` : relative.value;
}

/** Sidebar label such as "now" or "15m"; the English "ago" is dropped, other languages keep the phrase. */
export function formatCompactRelativeTimeLabel(isoDate: string): string {
  const date = parseTimestampDate(isoDate);
  if (!date) return "";
  if (Date.now() - date.getTime() < 60_000) return currentTranslator()("shellRest.justNowCompact");
  return formatRelativeTime(isoDate)?.value ?? "";
}

export function getRelativeTimeState(isoDate: string | null): RelativeTimeState {
  if (!isoDate) return { status: "missing" };
  const relative = formatRelativeTime(isoDate);
  if (!relative) return { status: "invalid" };
  return { status: "relative", ...relative };
}

/**
 * Relative elapsed duration since an ISO instant, without an "ago" suffix.
 * Useful for labels like "Connected for 3m".
 */
export function formatElapsedDurationLabel(isoDate: string, nowMs: number = Date.now()): string {
  const date = parseTimestampDate(isoDate);
  if (!date) return "";
  const diffMs = nowMs - date.getTime();
  if (diffMs <= 0) return currentTranslator()("shellRest.justNow");

  const seconds = Math.floor(diffMs / 1000);
  if (seconds < 5) return currentTranslator()("shellRest.justNow");
  if (seconds < 60) return durationText(seconds, "seconds");

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return durationText(minutes, "minutes");

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return durationText(hours, "hours");

  return durationText(Math.floor(hours / 24), "days");
}

/**
 * Relative time until an ISO instant (e.g. expiry). Mirrors {@link formatRelativeTime} but for future times.
 */
export function formatRelativeTimeUntil(isoDate: string): RelativeTimeParts | null {
  const date = parseTimestampDate(isoDate);
  if (!date) return null;
  const diffMs = date.getTime() - Date.now();
  if (diffMs <= 0) return { value: currentTranslator()("shellRest.expired"), suffix: null };
  const seconds = Math.floor(diffMs / 1000);
  if (seconds < 5) return { value: currentTranslator()("shellRest.soon"), suffix: null };
  if (seconds < 60) return relativePhrase(seconds, "seconds", "left");
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return relativePhrase(minutes, "minutes", "left");
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return relativePhrase(hours, "hours", "left");
  return relativePhrase(Math.floor(hours / 24), "days", "left");
}

export function formatRelativeTimeUntilLabel(isoDate: string): string {
  const relative = formatRelativeTimeUntil(isoDate);
  if (!relative) return "";
  return relative.suffix ? `${relative.value} ${relative.suffix}` : relative.value;
}

// Units from largest to smallest, each shown only when non-zero: "2d 3h 4m 5s".
function formatCountdown(totalSeconds: number): string {
  const days = Math.floor(totalSeconds / 86_400);
  const hours = Math.floor((totalSeconds % 86_400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const units: string[] = [];
  if (days > 0) units.push(durationText(days, "days"));
  if (hours > 0) units.push(durationText(hours, "hours"));
  if (minutes > 0) units.push(durationText(minutes, "minutes"));
  if (seconds > 0) units.push(durationText(seconds, "seconds"));
  return units.join(" ");
}

/**
 * Countdown for a future instant (e.g. link expiry): "Expires in 4m 12s", with second precision under one hour.
 * Pass `nowMs` when a parent tick drives re-renders so the diff matches that snapshot.
 */
export function formatExpiresInLabel(isoDate: string, nowMs: number = Date.now()): string {
  const date = parseTimestampDate(isoDate);
  if (!date) return "";
  const t = currentTranslator();
  const diffMs = date.getTime() - nowMs;
  if (diffMs <= 0) return t("shellRest.expired");

  const totalSeconds = Math.floor(diffMs / 1000);
  if (totalSeconds < 5) return t("shellRest.expiresInMoment");
  return t("shellRest.expiresIn", { duration: formatCountdown(totalSeconds) });
}
