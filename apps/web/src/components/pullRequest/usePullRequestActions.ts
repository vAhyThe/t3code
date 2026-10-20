import { useAtomCommand } from "~/state/use-atom-command";
import { scopeProjectRef } from "@t3tools/client-runtime/environment";
import { squashAtomCommandFailure } from "@t3tools/client-runtime/state/runtime";
import type {
  EnvironmentId,
  ProjectId,
  PullRequestAction,
  PullRequestDetail,
  PullRequestMergeMethod,
  PullRequestRef,
} from "@t3tools/contracts";
import { useRef, useState } from "react";
import { resolveProjectSettings } from "@t3tools/shared/projectSettings";
import { useClientSettings, useEnvironmentSettings } from "~/hooks/useSettings";
import {
  deriveLogicalProjectKeyFromSettings,
  derivePhysicalProjectKey,
  selectProjectGroupingSettings,
} from "~/logicalProject";
import { buildPhysicalToLogicalProjectKeyMap } from "~/sidebarProjectGrouping";
import { useProjects } from "~/state/entities";
import { usePrimaryEnvironmentId } from "~/state/environments";

import { type DraftId, useComposerDraftStore } from "~/composerDraftStore";
import { useNewThreadHandler } from "~/hooks/useHandleNewThread";
import { usePreparePullRequestThreadAction } from "~/lib/sourceControlActions";
import type { ReviewCommentContext } from "~/reviewCommentContext";
import { pullRequestEnvironment } from "~/state/pullRequests";

import { toastManager } from "../ui/toast";
import { handoffPrompt, handoffReviewComments, readableFailure } from "./pullRequestDetail.logic";
import { pullRequestEntryKey, type EnvironmentPullRequestEntry } from "./pullRequestList.logic";
import { currentTranslator } from "../../i18n/I18nProvider";

export function usePullRequestDefaultMergeMethodResolver(
  environmentId: EnvironmentId,
  projectId: ProjectId,
) {
  const projectDefault = useEnvironmentSettings(
    environmentId,
    (settings) => resolveProjectSettings(settings, projectId).settings.pullRequestMergeMethod,
  );
  const legacyOverrides = useClientSettings((settings) => settings.pullRequestMergeMethodOverrides);
  const grouping = useClientSettings(selectProjectGroupingSettings);
  const projects = useProjects();
  const primaryEnvironmentId = usePrimaryEnvironmentId();
  return () => {
    if (projectDefault != null) return projectDefault;
    if (Object.keys(legacyOverrides).length === 0) return undefined;
    const project = projects.find(
      (candidate) => candidate.environmentId === environmentId && candidate.id === projectId,
    );
    if (!project) return undefined;
    const key =
      buildPhysicalToLogicalProjectKeyMap({
        projects,
        settings: grouping,
        primaryEnvironmentId,
      }).get(derivePhysicalProjectKey(project)) ??
      deriveLogicalProjectKeyFromSettings(project, grouping);
    return legacyOverrides[key];
  };
}

const ACTION_SUCCESS_LABELS: Record<PullRequestAction, string> = {
  get merge() {
    return currentTranslator()("pullRequest.runSuccessMerge");
  },
  get ready() {
    return currentTranslator()("pullRequest.runSuccessReady");
  },
  get draft() {
    return currentTranslator()("pullRequest.runSuccessDraft");
  },
  get close() {
    return currentTranslator()("pullRequest.runSuccessClose");
  },
  get reopen() {
    return currentTranslator()("pullRequest.runSuccessReopen");
  },
  get "update-branch"() {
    return currentTranslator()("pullRequest.runSuccessUpdateBranch");
  },
  get "enable-auto-merge"() {
    return currentTranslator()("pullRequest.runSuccessEnableAutoMerge");
  },
  get "disable-auto-merge"() {
    return currentTranslator()("pullRequest.runSuccessDisableAutoMerge");
  },
  get revert() {
    return currentTranslator()("pullRequest.runSuccessRevert");
  },
  get "delete-branch"() {
    return currentTranslator()("pullRequest.runSuccessDeleteBranch");
  },
  get "approve-workflows"() {
    return currentTranslator()("pullRequest.runSuccessApproveWorkflows");
  },
};

const ACTION_FAILURE_LABELS: Record<PullRequestAction, string> = {
  get merge() {
    return currentTranslator()("pullRequest.runFailureMerge");
  },
  get ready() {
    return currentTranslator()("pullRequest.runFailureReady");
  },
  get draft() {
    return currentTranslator()("pullRequest.runFailureDraft");
  },
  get close() {
    return currentTranslator()("pullRequest.runFailureClose");
  },
  get reopen() {
    return currentTranslator()("pullRequest.runFailureReopen");
  },
  get "update-branch"() {
    return currentTranslator()("pullRequest.runFailureUpdateBranch");
  },
  get "enable-auto-merge"() {
    return currentTranslator()("pullRequest.runFailureEnableAutoMerge");
  },
  get "disable-auto-merge"() {
    return currentTranslator()("pullRequest.runFailureDisableAutoMerge");
  },
  get revert() {
    return currentTranslator()("pullRequest.runFailureRevert");
  },
  get "delete-branch"() {
    return currentTranslator()("pullRequest.runFailureDeleteBranch");
  },
  get "approve-workflows"() {
    return currentTranslator()("pullRequest.runFailureApproveWorkflows");
  },
};

const ACTION_FAILURE_HINTS: Record<PullRequestAction, string> = {
  get merge() {
    return currentTranslator()("pullRequest.runHintMerge");
  },
  get ready() {
    return currentTranslator()("pullRequest.runHintReady");
  },
  get draft() {
    return currentTranslator()("pullRequest.runHintDraft");
  },
  get close() {
    return currentTranslator()("pullRequest.runHintClose");
  },
  get reopen() {
    return currentTranslator()("pullRequest.runHintReopen");
  },
  get "update-branch"() {
    return currentTranslator()("pullRequest.runHintUpdateBranch");
  },
  get "enable-auto-merge"() {
    return currentTranslator()("pullRequest.runHintEnableAutoMerge");
  },
  get "disable-auto-merge"() {
    return currentTranslator()("pullRequest.runHintDisableAutoMerge");
  },
  get revert() {
    return currentTranslator()("pullRequest.runHintRevert");
  },
  get "delete-branch"() {
    return currentTranslator()("pullRequest.runHintDeleteBranch");
  },
  get "approve-workflows"() {
    return currentTranslator()("pullRequest.runHintApproveWorkflows");
  },
};

export function usePullRequestActionRunner({
  environmentId,
  reference,
  onSuccess,
  resolveMergeMethod,
}: {
  environmentId: EnvironmentId;
  reference: PullRequestRef | null;
  onSuccess?: (action: PullRequestAction) => void;
  /** Small surfaces resolve repository settings on the click, not for every visible row. */
  resolveMergeMethod?: (detail: PullRequestDetail) => PullRequestMergeMethod;
}) {
  const runAction = useAtomCommand(pullRequestEnvironment.runAction, {
    reportFailure: false,
  });
  const [actionPending, setActionPending] = useState(false);
  const pendingRef = useRef(false);

  const perform = async (action: PullRequestAction, method?: PullRequestMergeMethod) => {
    if (pendingRef.current || reference === null) return;
    pendingRef.current = true;
    setActionPending(true);
    const result = await runAction({
      environmentId,
      input: {
        ...reference,
        action,
        ...(method ? { mergeMethod: method } : resolveMergeMethod ? { resolveMergeMethod } : {}),
      },
    });
    pendingRef.current = false;
    setActionPending(false);
    if (result._tag === "Failure") {
      toastManager.add({
        type: "error",
        title: ACTION_FAILURE_LABELS[action],
        description: readableFailure(
          squashAtomCommandFailure(result),
          ACTION_FAILURE_HINTS[action],
        ),
      });
      return;
    }
    toastManager.add({ type: "success", title: ACTION_SUCCESS_LABELS[action] });
    onSuccess?.(action);
  };

  return { actionPending, perform };
}

export function usePullRequestCloseBatch(onClosed: (entry: EnvironmentPullRequestEntry) => void) {
  const runAction = useAtomCommand(pullRequestEnvironment.runAction, { reportFailure: false });
  const pending = useRef(new Set<string>());
  const [closingKeys, setClosingKeys] = useState<ReadonlySet<string>>(() => new Set());
  const close = async (entries: readonly EnvironmentPullRequestEntry[]) => {
    const batch = entries.filter((entry) => {
      const key = pullRequestEntryKey(entry);
      if (entry.state !== "open" || pending.current.has(key)) return false;
      pending.current.add(key);
      return true;
    });
    if (batch.length === 0) return;
    setClosingKeys(new Set(pending.current));
    const failures: string[] = [];
    const outcomes = await Promise.all(
      batch.map(async (entry) => {
        const result = await runAction({
          environmentId: entry.environmentId,
          input: {
            projectId: entry.projectId,
            host: entry.host,
            repository: entry.repository,
            number: entry.number,
            action: "close",
          },
        });
        pending.current.delete(pullRequestEntryKey(entry));
        setClosingKeys(new Set(pending.current));
        if (result._tag === "Failure") {
          failures.push(
            `#${entry.number}: ${readableFailure(squashAtomCommandFailure(result), ACTION_FAILURE_HINTS.close)}`,
          );
          return;
        }
        onClosed(entry);
        return true;
      }),
    );
    const closed = outcomes.filter(Boolean).length;
    toastManager.add({
      type: failures.length > 0 ? "error" : "success",
      title:
        failures.length > 0
          ? currentTranslator()("pullRequest.closedOfTotal", { closed, total: batch.length })
          : currentTranslator()("pullRequest.closedCount", { count: closed }),
      ...(failures.length > 0 ? { description: failures.slice(0, 3).join("\n") } : {}),
    });
  };
  return { close, closingKeys };
}

export interface PullRequestThreadTask {
  prompt: string;
  reviewComments?: ReadonlyArray<ReviewCommentContext>;
}

export type PullRequestHandoffDetail = Pick<
  PullRequestDetail,
  "projectId" | "workspaceRoot" | "url"
>;

const lastHandoffPromptByDraft = new Map<DraftId, string>();

export function usePullRequestHandoffs({
  environmentId,
  detail,
}: {
  environmentId: EnvironmentId;
  detail: PullRequestHandoffDetail | null;
}) {
  const newThread = useNewThreadHandler();
  const prepareThread = usePreparePullRequestThreadAction({
    environmentId,
    cwd: detail?.workspaceRoot ?? null,
  });
  // One at a time whatever the key: they all check the same pull request out.
  const [handoff, setHandoff] = useState<string | null>(null);

  /**
   * Nothing is checked out: asking a question is not a reason to move somebody's working tree
   * or to make a worktree they did not ask for.
   */
  const openThreadWithTask = async (
    projectRef: ReturnType<typeof scopeProjectRef>,
    task: PullRequestThreadTask | null,
    opened?: { draftId: DraftId },
  ): Promise<{ draftId: DraftId } | null> => {
    const session =
      opened ??
      (await newThread(projectRef).then(
        (result) => result,
        () => null,
      ));
    if (session === null) return null;
    const store = useComposerDraftStore.getState();
    if (task === null) return session;
    const draft = store.getComposerDraft(session.draftId);
    const existingComments = draft?.reviewComments ?? [];
    const prompt = handoffPrompt(
      {
        prompt: draft?.prompt ?? "",
        lastHandoffPrompt: lastHandoffPromptByDraft.get(session.draftId),
      },
      task.prompt,
    );
    // Remember the hand-off's own contribution, not the merged prompt: only that sentence is
    // this session's to take back next time, and the reader's text around it is not.
    lastHandoffPromptByDraft.set(session.draftId, task.prompt);
    store.setPrompt(session.draftId, prompt);
    store.setReviewComments(
      session.draftId,
      handoffReviewComments(existingComments, task.reviewComments ?? []),
    );
    return session;
  };

  const startAsk = async (kind: string, task: PullRequestThreadTask) => {
    if (!detail || handoff !== null) return;
    setHandoff(kind);
    const projectRef = scopeProjectRef(environmentId, detail.projectId);
    const opened = await openThreadWithTask(projectRef, task);
    setHandoff(null);
    if (opened === null) {
      toastManager.add({
        type: "error",
        title: currentTranslator()("pullRequest.couldNotOpenThread"),
        description: currentTranslator()("pullRequest.openThreadFirst"),
      });
      return;
    }
    toastManager.add({
      type: "success",
      title: currentTranslator()("pullRequest.askedInThread"),
      description:
        task.prompt.length > 0
          ? currentTranslator()("pullRequest.questionInComposer")
          : currentTranslator()("pullRequest.pullRequestInComposer"),
    });
  };

  const startHandoff = async (
    kind: string,
    task: PullRequestThreadTask | null,
    mode: "worktree" | "local" = "worktree",
  ) => {
    if (!detail || handoff !== null) return;
    setHandoff(kind);
    // It carries no timeout of its own: a loading toast never expires, and an explicit one
    // would survive the update and pin the result on screen.
    const toastId = toastManager.add({
      type: "loading",
      title: currentTranslator()("pullRequest.preparingCheckout"),
    });
    const projectRef = scopeProjectRef(environmentId, detail.projectId);
    // The thread is opened before the checkout rather than after it, because the project's setup
    // script only runs for a checkout that knows which thread it is for — and a worktree with no
    // dependencies installed is not something anyone can test.
    const opened = await newThread(projectRef).then(
      (session) => session,
      () => null,
    );
    if (opened === null) {
      setHandoff(null);
      toastManager.update(toastId, {
        type: "error",
        title: currentTranslator()("pullRequest.couldNotOpenThreadForCheckout"),
        description: currentTranslator()("pullRequest.openThreadFirst"),
      });
      return;
    }
    const prepared = await prepareThread.run({
      reference: detail.url,
      mode,
      threadId: opened.threadId,
    });
    if (prepared._tag === "Failure") {
      setHandoff(null);
      const detailMessage =
        prepareThread.error instanceof Error ? prepareThread.error.message : null;
      toastManager.update(toastId, {
        type: "error",
        title: currentTranslator()("pullRequest.couldNotPrepareCheckout"),
        ...(detailMessage ? { description: detailMessage } : {}),
      });
      return;
    }
    const pointed = await newThread(projectRef, {
      branch: prepared.value.branch,
      worktreePath: prepared.value.worktreePath,
      envMode: prepared.value.worktreePath === null ? "local" : "worktree",
    }).then(
      (session) => session !== null,
      () => false,
    );
    if (!pointed) {
      setHandoff(null);
      toastManager.update(toastId, {
        type: "error",
        title: currentTranslator()("pullRequest.checkedOutThreadStayed"),
        description: currentTranslator()("pullRequest.checkoutReadyOnBranch", {
          branch: prepared.value.branch,
        }),
      });
      return;
    }
    setHandoff(null);
    const staleCheckoutToast = {
      type: "warning",
      title: currentTranslator()("pullRequest.checkedOutNotLatest"),
      description: currentTranslator()("pullRequest.checkoutNotMovedLatest"),
    } as const;
    if (task === null) {
      toastManager.update(
        toastId,
        prepared.value.isOnPullRequestHead
          ? {
              type: "success",
              title:
                mode === "local"
                  ? currentTranslator()("pullRequest.checkedOutHere")
                  : currentTranslator()("pullRequest.checkedOut"),
              description:
                mode === "local"
                  ? currentTranslator()("pullRequest.branchThreadOpen")
                  : currentTranslator()("pullRequest.worktreeThreadOpen"),
            }
          : staleCheckoutToast,
      );
      return;
    }
    await openThreadWithTask(projectRef, task, opened);
    toastManager.update(
      toastId,
      prepared.value.isOnPullRequestHead
        ? {
            type: "success",
            title: currentTranslator()("pullRequest.checkoutReady"),
            description: currentTranslator()("pullRequest.taskInComposer"),
          }
        : staleCheckoutToast,
    );
  };

  return { handoff, startAsk, startHandoff };
}
