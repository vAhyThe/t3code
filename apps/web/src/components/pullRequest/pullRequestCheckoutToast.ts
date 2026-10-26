import { currentTranslator } from "~/i18n/I18nProvider";
import type { ChangeRequestTerminology } from "@t3tools/client-runtime/source-control-clients";

export function offHeadPullRequestCheckoutToast(terminology: ChangeRequestTerminology) {
  return {
    type: "warning",
    title: currentTranslator()("updates.checkedOutButNotConfirmedOnTheLatest"),
    description: currentTranslator()("updates.thisCheckoutCouldNotBeConfirmedAtThe", {
      term: terminology.singular,
    }),
  } as const;
}
