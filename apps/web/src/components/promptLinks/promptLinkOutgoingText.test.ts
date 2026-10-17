import {
  buildNewThreadLink,
  parseNewThreadLink,
  promptLinkPullRequestUrl,
} from "@t3tools/shared/promptLinks";
import { afterEach, beforeEach, describe, expect, it } from "vite-plus/test";

import { currentTranslator, localeStore } from "~/i18n/I18nProvider";

describe("prompt link text in a Czech interface", () => {
  beforeEach(() => {
    localeStore.sync({ hydrated: true, preference: "cs" });
  });
  afterEach(() => {
    localeStore.sync({ hydrated: true, preference: "en" });
  });

  it("keeps the link, its prompt and the pull request reference in English", () => {
    expect(currentTranslator()("common.cancel")).toBe("Zrušit");
    const link = buildNewThreadLink({
      prompt: "Fix the failing test",
      repository: { owner: "acme", name: "app" },
      origin: "https://app.example",
    });
    expect(link).toBe("https://app.example/new?prompt=Fix+the+failing+test&repo=acme%2Fapp");

    const parsed = parseNewThreadLink(new URL(link).search);
    expect(parsed.ok && parsed.value.prompt?.text).toBe("Fix the failing test");

    expect(promptLinkPullRequestUrl({ owner: "acme", name: "app", number: 7 })).toBe(
      "https://github.com/acme/app/pull/7",
    );
  });
});
