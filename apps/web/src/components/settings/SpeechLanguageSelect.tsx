import type { EnvironmentSpeechStatus } from "@t3tools/contracts";
import { effectiveSpeechLanguage } from "@t3tools/shared/speech";
import { localeStore, useT } from "~/i18n/I18nProvider";
import { updateClientSettings, useClientSettings } from "../../hooks/useSettings";
import { Select, SelectItem, SelectPopup, SelectTrigger, SelectValue } from "../ui/select";

const languageNamesByLocale = new Map<string, Intl.DisplayNames>();
/** Language names follow the interface language and are read when the label is rendered. */
export const languageLabel = (code: string) => {
  const locale = localeStore.getLocale();
  let names = languageNamesByLocale.get(locale);
  if (!names) {
    names = new Intl.DisplayNames([locale], { type: "language" });
    languageNamesByLocale.set(locale, names);
  }
  try {
    return names.of(code) ?? code;
  } catch {
    return code;
  }
};

type ModelLanguages = Pick<
  Extract<EnvironmentSpeechStatus, { supported: true }>,
  "languages" | "supportsLanguageDetection"
>;

export function SpeechLanguageSelect({ model }: { readonly model: ModelLanguages | null }) {
  const t = useT();
  const preference = useClientSettings((settings) => settings.speechLanguage);
  const languages = model?.languages ?? [];
  const resolved = model
    ? effectiveSpeechLanguage(
        { languages, supportsLanguageDetection: model.supportsLanguageDetection ?? false },
        preference,
      )
    : preference;
  const effectiveLabel =
    resolved === "auto" ? t("voiceSettings.languageAutoDetect") : languageLabel(resolved);
  const unavailable =
    preference !== "auto" && preference !== resolved
      ? t("voiceSettings.languageUnavailable", { language: languageLabel(preference) })
      : null;
  const label = unavailable
    ? `${effectiveLabel} (${unavailable})`
    : preference === "auto" && resolved !== "auto"
      ? t("voiceSettings.languageAutoWith", { language: effectiveLabel })
      : effectiveLabel;
  return (
    <Select
      value={preference}
      disabled={!model}
      onValueChange={(value) => {
        if (value) void updateClientSettings({ speechLanguage: value });
      }}
    >
      <SelectTrigger
        size="sm"
        aria-label={t("voiceSettings.languageTranscriptionAria")}
        className="max-w-64"
      >
        <SelectValue>{label}</SelectValue>
      </SelectTrigger>
      <SelectPopup align="end" alignItemWithTrigger={false}>
        <SelectItem value="auto">{t("voiceSettings.languageAuto")}</SelectItem>
        {unavailable ? (
          <SelectItem value={preference} disabled>
            {unavailable}
          </SelectItem>
        ) : null}
        {languages
          .toSorted((left, right) => languageLabel(left).localeCompare(languageLabel(right)))
          .map((code) => (
            <SelectItem key={code} value={code}>
              {languageLabel(code)}
            </SelectItem>
          ))}
      </SelectPopup>
    </Select>
  );
}
