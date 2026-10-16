// @effect-diagnostics globalDate:off -- formatRelativeTime takes plain Dates, as its web callers hold them.
import { describe, expect, it } from "vite-plus/test";

import { formatRelativeTime } from "./relativeTime.ts";

const now = new Date("2026-10-16T12:00:00.000Z");
const before = (ms: number) => new Date(now.getTime() - ms);
const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

describe("formatRelativeTime", () => {
  it.each([
    [30_000, "just now", "právě teď"],
    [5 * MINUTE, "5m ago", "před 5 min"],
    [3 * HOUR, "3h ago", "před 3 h"],
    [2 * DAY, "2d ago", "před 2 dny"],
  ])("formats %d ms ago in English and Czech", (elapsed, english, czech) => {
    expect(formatRelativeTime(before(elapsed), now, "en")).toBe(english);
    expect(formatRelativeTime(before(elapsed), now, "cs")).toBe(czech);
  });

  it("treats a time in the future as just now", () => {
    expect(formatRelativeTime(new Date(now.getTime() + MINUTE), now, "en")).toBe("just now");
  });
});
