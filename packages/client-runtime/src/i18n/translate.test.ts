import { describe, expect, it } from "vite-plus/test";

import { csMessages } from "./messages/cs/index.ts";
import type { CzechNamespace } from "./messages/en/index.ts";
import { createCatalogTranslator, createTranslator } from "./translate.ts";

const threads = { one: "{count} thread", other: "{count} threads" };
const english = {
  test: { greeting: "Hello {name}", threads, onlyEnglish: "Only in English" },
};
const czech = {
  test: {
    greeting: "Ahoj {name}",
    threads: { one: "one", few: "few", many: "many", other: "other" },
  },
};

describe("createTranslator", () => {
  it("interpolates parameters", () => {
    const t = createCatalogTranslator("en", english, english);
    expect(t("test.greeting" as never, { name: "Ada" })).toBe("Hello Ada");
  });

  it("selects Czech plural forms by count", () => {
    const t = createCatalogTranslator("cs", czech, english);
    const forms = [1, 2, 4, 5, 22, 1.5].map((count) => t("test.threads" as never, { count }));
    expect(forms).toEqual(["one", "few", "few", "other", "other", "many"]);
  });

  it("selects English plural forms and interpolates the count", () => {
    const t = createCatalogTranslator("en", english, english);
    expect(t("test.threads" as never, { count: 1 })).toBe("1 thread");
    expect(t("test.threads" as never, { count: 3 })).toBe("3 threads");
  });

  it("falls back to English when a Czech message is missing", () => {
    const t = createCatalogTranslator("cs", czech, english);
    expect(t("test.onlyEnglish" as never)).toBe("Only in English");
  });

  it("leaves an unknown parameter in the text", () => {
    const t = createCatalogTranslator("en", english, english);
    expect(t("test.greeting" as never)).toBe("Hello {name}");
  });

  it("translates the shipped catalogs", () => {
    expect(createTranslator("en")("common.cancel")).toBe("Cancel");
    expect(createTranslator("cs")("common.cancel")).toBe("Zrušit");
  });

  it("requires every English key in a Czech namespace", () => {
    const { cancel: _cancel, ...withoutCancel } = csMessages.common;
    // @ts-expect-error a Czech namespace missing an English key must not typecheck
    const incomplete = withoutCancel satisfies CzechNamespace<"common">;
    expect(incomplete).not.toHaveProperty("cancel");
  });
});
