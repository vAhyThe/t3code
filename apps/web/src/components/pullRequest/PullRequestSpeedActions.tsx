import { useAtomValue } from "@effect/atom-react";
import type { PullRequestAction } from "@t3tools/contracts";
import { pullRequestEnvironment } from "~/state/pullRequests";
import { useUiStateStore } from "~/uiStateStore";
import { Button } from "../ui/button";
import { Spinner } from "../ui/spinner";
import { Tooltip, TooltipPopup, TooltipTrigger } from "../ui/tooltip";
import { resolvePullRequestMergeMethod } from "./pullRequestDetail.logic";
import { PullRequestGlyph } from "./pullRequestIcons";
import { pullRequestQuickActions, type EnvironmentPullRequestEntry } from "./pullRequestList.logic";
import {
  usePullRequestActionRunner,
  usePullRequestDefaultMergeMethodResolver,
} from "./usePullRequestActions";
import { useT } from "../../i18n/I18nProvider";

type PullRequestSpeedActionEntry = Pick<
  EnvironmentPullRequestEntry,
  "environmentId" | "projectId" | "host" | "repository" | "number" | "state" | "isDraft"
> & { readonly stack?: object | undefined };

export interface PullRequestSpeedActionResult<Entry = EnvironmentPullRequestEntry> {
  readonly entry: Entry;
  readonly action: PullRequestAction;
}

/** No detail or stack reads until a merge is clicked, even on a long list. */
export function PullRequestSpeedActions<Entry extends PullRequestSpeedActionEntry>({
  entry,
  hostActions,
  visible,
  onActed,
  closing = false,
  sweeping = false,
  onCloseSweepStart,
}: {
  entry: Entry;
  /** What the row's host can do; actions it cannot are not offered. */
  hostActions: ReadonlySet<PullRequestAction>;
  visible: boolean;
  onActed?: (result: PullRequestSpeedActionResult<Entry>) => void;
  closing?: boolean;
  sweeping?: boolean;
  onCloseSweepStart?: (entry: Entry, event: PointerEvent) => void;
}) {
  const t = useT();
  const canWrite = useAtomValue(
    pullRequestEnvironment.runAction.permissionAtom(entry.environmentId),
  );
  const resolveProjectDefault = usePullRequestDefaultMergeMethodResolver(
    entry.environmentId,
    entry.projectId,
  );
  const reference = {
    projectId: entry.projectId,
    host: entry.host,
    repository: entry.repository,
    number: entry.number,
  };
  const { actionPending, perform } = usePullRequestActionRunner({
    environmentId: entry.environmentId,
    reference,
    onSuccess: (action) => onActed?.({ entry, action }),
    resolveMergeMethod: (detail) => {
      const allowed = detail.capabilities.mergeMethods.filter(
        (method) => detail.mergeCapabilities[method],
      );
      if (allowed.length === 0)
        throw new Error("No merge method is available for this repository.");
      return resolvePullRequestMergeMethod(
        allowed,
        null,
        resolveProjectDefault(),
        useUiStateStore.getState().pullRequestMergeMethod,
      );
    },
  });
  const actions = pullRequestQuickActions(entry, hostActions);
  const busy = actionPending || closing || sweeping;
  if (actions.length === 0) return null;
  return (
    <div
      className="shrink-0 items-center gap-1 pr-3"
      style={{ display: visible || busy ? "flex" : "none" }}
      role="group"
      aria-label={t("pullRequest.quickActions", { number: entry.number })}
      data-pull-request-action-pending={actionPending || closing}
    >
      {actions.map((action) => {
        const label = t(ACTIONS[action].labelKey);
        const Icon = ACTIONS[action].Icon;
        return (
          <Tooltip key={action}>
            <TooltipTrigger
              render={
                <Button
                  variant={action === "close" ? "destructive-outline" : "outline"}
                  size="xs"
                  disabled={!canWrite || busy || (action === "merge" && entry.stack !== undefined)}
                  aria-label={`${label} #${entry.number}`}
                  onClick={() => void perform(action)}
                  onPointerDown={(event) => {
                    if (action !== "close" || !event.isPrimary || event.button !== 0) return;
                    event.stopPropagation();
                    onCloseSweepStart?.(entry, event.nativeEvent);
                  }}
                />
              }
            >
              {busy ? <Spinner size="xs" /> : <Icon aria-hidden className="size-3" />}
              {label}
            </TooltipTrigger>
            <TooltipPopup>
              {action === "merge" && entry.stack
                ? t("pullRequest.openToMergeStack")
                : action === "close" && onCloseSweepStart
                  ? t("pullRequest.closeImmediatelyOrSweep")
                  : t("pullRequest.actionImmediately", { action: label })}
            </TooltipPopup>
          </Tooltip>
        );
      })}
    </div>
  );
}

const ACTIONS = {
  close: { labelKey: "pullRequest.actionClose", Icon: PullRequestGlyph.closed },
  merge: { labelKey: "pullRequest.actionMerge", Icon: PullRequestGlyph.merged },
  ready: { labelKey: "pullRequest.actionReady", Icon: PullRequestGlyph.pullRequest },
  reopen: { labelKey: "pullRequest.actionReopen", Icon: PullRequestGlyph.reopen },
} as const;
