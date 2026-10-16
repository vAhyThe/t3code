import {
  createTranslator,
  type MessageKey,
  type MessageParams,
  type Translate,
} from "@t3tools/client-runtime/i18n";

const english = createTranslator("en");

/**
 * Search terms for a translated label: the shown text first so it ranks
 * highest, then the English source, which users still remember from docs
 * and from before they switched language.
 */
export function searchLabels(t: Translate, key: MessageKey, params?: MessageParams): string[] {
  const shown = t(key, params);
  const source = english(key, params);
  return shown === source ? [source] : [shown, source];
}
