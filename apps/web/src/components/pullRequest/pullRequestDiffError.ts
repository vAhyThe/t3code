import { currentTranslator } from "~/i18n/I18nProvider";
/** Diff failures currently include transport wrappers, so recognize the reason inside them. */
export function describePullRequestDiffError(error: string, providerName: string) {
  if (/\brate limit\b|\brate[-_]limited\b|\btoo many requests\b/i.test(error)) {
    return {
      title: currentTranslator()("pullRequest.diffRateLimited", { providerName }),
      description: currentTranslator()("pullRequest.diffRateLimitedDescription", { providerName }),
    };
  }

  return {
    title: currentTranslator()("pullRequest.diffChangesLoadFailed"),
    description: currentTranslator()("pullRequest.diffLoadFailedDescription", { providerName }),
  };
}
