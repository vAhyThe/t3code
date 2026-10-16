import { describe, expect, it, vi } from "vite-plus/test";

import { createMemoryStorage } from "../lib/storage";
import { createUiLocaleStore, UI_LOCALE_STORAGE_KEY, uiSystemLanguages } from "./uiLocaleStore";

function storageWith(cached: string | null) {
  const storage = createMemoryStorage();
  if (cached !== null) storage.setItem(UI_LOCALE_STORAGE_KEY, cached);
  return storage;
}

describe("ui locale store", () => {
  it("uses the cached locale before client settings hydrate", () => {
    const store = createUiLocaleStore({ storage: storageWith("cs"), systemLanguages: ["en-US"] });
    store.sync({ hydrated: false, preference: "en" });
    expect(store.getLocale()).toBe("cs");
  });

  it("lets the hydrated setting win and updates the cache", () => {
    const storage = storageWith("cs");
    const store = createUiLocaleStore({ storage, systemLanguages: ["cs-CZ"] });
    const listener = vi.fn();
    store.subscribe(listener);

    store.sync({ hydrated: true, preference: "en" });

    expect(store.getLocale()).toBe("en");
    expect(storage.getItem(UI_LOCALE_STORAGE_KEY)).toBe("en");
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("resolves the system language without a cache", () => {
    const store = createUiLocaleStore({ storage: storageWith(null), systemLanguages: ["cs-CZ"] });
    expect(store.getLocale()).toBe("cs");
  });

  it("ignores a cached value this build does not support", () => {
    const store = createUiLocaleStore({ storage: storageWith("ja"), systemLanguages: ["en-US"] });
    expect(store.getLocale()).toBe("en");
  });

  it("keeps working when storage throws", () => {
    const storage = {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      },
    };
    const store = createUiLocaleStore({ storage, systemLanguages: ["cs"] });
    store.sync({ hydrated: true, preference: "en" });
    expect(store.getLocale()).toBe("en");
  });
});

describe("uiSystemLanguages", () => {
  it("reads the desktop system locale before navigator.languages, which Electron pins to en-US", () => {
    expect(uiSystemLanguages("cs_CZ", ["en-US"])).toEqual(["cs-CZ", "en-US"]);
  });

  it("reads navigator.languages in a browser", () => {
    expect(uiSystemLanguages(null, ["cs", "en"])).toEqual(["cs", "en"]);
  });
});
