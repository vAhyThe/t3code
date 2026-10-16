import { describe, expect, it } from "vite-plus/test";

import { resolveUiLocale } from "./locales.ts";

describe("resolveUiLocale", () => {
  it("uses an explicit preference over the system languages", () => {
    expect(resolveUiLocale("cs", ["en-US"])).toBe("cs");
  });

  it("picks the first supported system language in preference order", () => {
    expect(resolveUiLocale("system", ["de-DE", "cs-CZ", "en"])).toBe("cs");
  });

  it("falls back to English without a supported system language", () => {
    expect(resolveUiLocale("system", ["de-DE"])).toBe("en");
    expect(resolveUiLocale("system", [])).toBe("en");
  });

  it("matches system languages case-insensitively", () => {
    expect(resolveUiLocale("system", ["CS"])).toBe("cs");
  });
});
