import {
  createTranslator,
  resolveUiLocale,
  type Translate,
  type UiLocale,
} from "@t3tools/client-runtime/i18n";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";

import * as ElectronApp from "../electron/ElectronApp.ts";
import * as DesktopClientSettings from "../settings/DesktopClientSettings.ts";

let currentLocale: UiLocale = "en";

/**
 * Reads the saved interface language and the OS language, and makes them the
 * locale of every desktop text from now on. The application menu calls this on
 * each build, which covers startup and every settings save.
 */
export const refreshDesktopTranslator: Effect.Effect<
  Translate,
  never,
  DesktopClientSettings.DesktopClientSettings | ElectronApp.ElectronApp
> = Effect.gen(function* () {
  const clientSettings = yield* DesktopClientSettings.DesktopClientSettings;
  const electronApp = yield* ElectronApp.ElectronApp;
  const settings = yield* clientSettings.get.pipe(Effect.orElseSucceed(Option.none));
  const interfaceLanguage = Option.match(settings, {
    onNone: () => "system" as const,
    onSome: (clientSettingsValue) => clientSettingsValue.interfaceLanguage,
  });
  const systemLocale = yield* electronApp.systemLocale;
  currentLocale = resolveUiLocale(interfaceLanguage, [systemLocale]);
  return createTranslator(currentLocale);
});

/** Translator for the locale last read by refreshDesktopTranslator. Call it where the text is produced. */
export const currentDesktopTranslator = (): Translate => createTranslator(currentLocale);
