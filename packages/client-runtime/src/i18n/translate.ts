import type { UiLocale } from "./locales.ts";
import { csMessages } from "./messages/cs/index.ts";
import { enMessages, type MessageKey } from "./messages/en/index.ts";
import type { Catalog, Message } from "./messages/types.ts";

export type { PluralMessage } from "./messages/types.ts";
export type { MessageKey } from "./messages/en/index.ts";

export type MessageParams = Readonly<Record<string, string | number>>;
export type Translate = (key: MessageKey, params?: MessageParams) => string;

const CATALOGS: Record<UiLocale, Catalog> = { en: enMessages, cs: csMessages };

const PARAMETER = /\{(\w+)\}/g;

function lookup(catalog: Catalog, key: string): Message | undefined {
  const separator = key.indexOf(".");
  if (separator === -1) return undefined;
  return catalog[key.slice(0, separator)]?.[key.slice(separator + 1)];
}

/**
 * Builds a translator over explicit catalogs. A key missing from `messages`
 * falls back to `fallback`, then to the key itself, so a gap shows up as text
 * instead of an empty label.
 */
export function createCatalogTranslator(
  locale: UiLocale,
  messages: Catalog,
  fallback: Catalog,
): Translate {
  const pluralRules = new Intl.PluralRules(locale);
  return (key, params) => {
    const message = lookup(messages, key) ?? lookup(fallback, key);
    if (message === undefined) return key;
    let text: string;
    if (typeof message === "string") {
      text = message;
    } else {
      const count = Number(params?.count);
      const category = Number.isFinite(count) ? pluralRules.select(count) : "other";
      const form =
        category === "one" || category === "few" || category === "many"
          ? message[category]
          : undefined;
      text = form ?? message.other;
    }
    if (!params) return text;
    return text.replace(PARAMETER, (slot, name: string) => {
      const value = params[name];
      return value === undefined ? slot : String(value);
    });
  };
}

const translators = new Map<UiLocale, Translate>();

/** Returns the shared translator for a locale, with English as the fallback. */
export function createTranslator(locale: UiLocale): Translate {
  let translator = translators.get(locale);
  if (!translator) {
    translator = createCatalogTranslator(locale, CATALOGS[locale], enMessages);
    translators.set(locale, translator);
  }
  return translator;
}
