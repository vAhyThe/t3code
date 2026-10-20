import type {
  SubagentWorkflowGroup,
  RuntimeSubagent,
} from "@t3tools/client-runtime/state/subagentRuntime";
import type { ProviderDriverKind, ProviderInstanceId, ServerProvider } from "@t3tools/contracts";
import { ChevronDownIcon, LoaderCircleIcon, SquareIcon } from "lucide-react";
import { useState, type ReactNode } from "react";
import type { MessageKey } from "@t3tools/client-runtime/i18n";

import { AgentElapsed } from "./AgentElapsed";
import { SubagentTooltipContent } from "./SubagentTooltipContent";
import { ThreadHoverCardPopup } from "../ThreadHoverCard";
import { ThreadRelationshipIcon } from "./ThreadRelationshipIcon";
import { cn } from "../../lib/utils";
import { ThreadDetailsControl } from "./ThreadDetailsControl";
import { CollapsibleSectionHeader, SectionHeaderStatus } from "../ui/collapsible-section-header";
import { Tooltip, TooltipPopup, TooltipTrigger } from "../ui/tooltip";
import {
  THREAD_DETAILS_PANEL_SPLIT_GROUP_CLASS,
  THREAD_DETAILS_PANEL_SPLIT_SEPARATOR_CLASS,
} from "./threadDetailsPanelStyles";
import { useT } from "~/i18n/I18nProvider";

function phaseElapsed(phase: SubagentWorkflowGroup["phases"][number]) {
  const instants = (key: "startedAt" | "completedAt") =>
    phase.members
      .map((member) => member[key])
      .filter((value) => value !== null)
      .sort();
  const running = phase.state === "running";
  const startedAt = instants("startedAt")[0] ?? null;
  const completedAt = running ? null : (instants("completedAt").at(-1) ?? null);
  return {
    status: running ? ("running" as const) : ("completed" as const),
    startedAt: running || completedAt !== null ? startedAt : null,
    completedAt,
  };
}

function phaseStatusLabel(phase: SubagentWorkflowGroup["phases"][number]) {
  if (phase.state === "running") return "running";
  if (phase.members.some((member) => member.status === "failed")) return "failed";
  if (
    phase.members.some((member) => member.status === "cancelled" || member.status === "interrupted")
  ) {
    return "stopped";
  }
  return phase.state === "done" ? "done" : "not started";
}

const PHASE_STATUS_LABEL_KEYS = {
  running: "chat.lineagePhaseStatusRunning",
  failed: "chat.lineagePhaseStatusFailed",
  stopped: "chat.lineagePhaseStatusStopped",
  done: "chat.lineagePhaseStatusDone",
  "not started": "chat.lineagePhaseStatusNotStarted",
} as const satisfies Record<ReturnType<typeof phaseStatusLabel>, MessageKey>;

const MEMBER_STATUS_LABEL_KEYS = {
  pending: "chat.lineageMemberStatusPending",
  running: "chat.lineageMemberStatusRunning",
  waiting: "chat.lineageMemberStatusWaiting",
  idle: "chat.lineageMemberStatusIdle",
  completed: "chat.lineageMemberStatusCompleted",
  failed: "chat.lineageMemberStatusFailed",
  cancelled: "chat.lineageMemberStatusCancelled",
  interrupted: "chat.lineageMemberStatusInterrupted",
} as const satisfies Record<RuntimeSubagent["status"], MessageKey>;

function WorkflowMemberRow({
  member,
  providerInstanceId,
  provider,
  providers,
  driver,
  onOpen,
  isThreadAvailable,
}: {
  member: RuntimeSubagent;
  providerInstanceId: ProviderInstanceId;
  provider: ServerProvider | undefined;
  providers: ReadonlyArray<ServerProvider> | undefined;
  driver: ProviderDriverKind | undefined;
  onOpen: (threadId: string) => void;
  isThreadAvailable: (threadId: string) => boolean;
}) {
  const t = useT();
  const threadId = member.childThreadId;
  const canOpen = threadId !== null && isThreadAvailable(threadId);
  return (
    <li>
      <Tooltip>
        <TooltipTrigger
          delay={200}
          render={
            <ThreadDetailsControl
              part="row"
              aria-label={t("chat.lineageOpenMemberChat", { title: member.title })}
              disabled={!canOpen}
              onClick={() => canOpen && onOpen(threadId)}
            />
          }
        >
          <ThreadRelationshipIcon driver={driver} provider={provider} status={member.status} />
          <span className="min-w-0 flex-1 truncate">{member.title}</span>
          <span className="sr-only">{t(MEMBER_STATUS_LABEL_KEYS[member.status])}</span>
          {member.startedAt ? (
            <span className="shrink-0 text-2xs font-normal tabular-nums text-muted-foreground">
              <AgentElapsed agent={member} />
            </span>
          ) : null}
        </TooltipTrigger>
        <ThreadHoverCardPopup side="left">
          <SubagentTooltipContent
            title={member.title}
            model={member.model}
            providerInstanceId={providerInstanceId}
            origin="provider_native"
            provider={provider}
            providers={providers}
            driver={driver}
            elapsed={<AgentElapsed agent={member} />}
            status={member.status}
            result={member.result ?? member.error}
            progress={member.progress}
          />
        </ThreadHoverCardPopup>
      </Tooltip>
    </li>
  );
}

export function ThreadLineageWorkflowRow({
  group,
  header,
  providerInstanceId,
  provider,
  providers,
  driver,
  onOpenThread,
  isThreadAvailable,
  onStop,
  stopping,
  stopDisabled,
}: {
  readonly group: SubagentWorkflowGroup;
  readonly header: ReactNode;
  readonly providerInstanceId: ProviderInstanceId;
  readonly provider: ServerProvider | undefined;
  readonly providers: ReadonlyArray<ServerProvider> | undefined;
  readonly driver: ProviderDriverKind | undefined;
  readonly onOpenThread: (threadId: string) => void;
  readonly isThreadAvailable: (threadId: string) => boolean;
  readonly onStop?: (() => void) | undefined;
  readonly stopping: boolean;
  readonly stopDisabled: boolean;
}) {
  const t = useT();
  const [expanded, setExpanded] = useState(false);
  const [phaseOpen, setPhaseOpen] = useState<ReadonlyMap<number, boolean>>(() => new Map());
  const label = group.workflow.workflowName ?? group.workflow.title;
  const phases = group.phases.filter((phase) => phase.members.length > 0);
  return (
    <li className="group" data-workflow-expanded={expanded ? "" : undefined}>
      <div className={cn("relative", THREAD_DETAILS_PANEL_SPLIT_GROUP_CLASS)}>
        {header}
        {onStop ? (
          <div className="pointer-events-none absolute right-9 top-1/2 -translate-y-1/2 opacity-0 group-hover:pointer-events-auto group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:opacity-100 pointer-coarse:pointer-events-auto pointer-coarse:opacity-100 [@media(hover:none)]:pointer-events-auto [@media(hover:none)]:opacity-100">
            <Tooltip>
              <TooltipTrigger
                render={
                  <ThreadDetailsControl
                    size="icon-xs"
                    variant="ghost"
                    part="icon"
                    tone="destructive"
                    aria-label={t("chat.lineageStopWorkflow", { label })}
                    disabled={stopDisabled}
                    onClick={onStop}
                  />
                }
              >
                {stopping ? (
                  <LoaderCircleIcon aria-hidden className="size-3 animate-spin" />
                ) : (
                  <SquareIcon aria-hidden className="size-3 fill-current" />
                )}
              </TooltipTrigger>
              <TooltipPopup side="left">{t("chat.lineageStopEntireWorkflow")}</TooltipPopup>
            </Tooltip>
          </div>
        ) : null}
        <span aria-hidden="true" className={THREAD_DETAILS_PANEL_SPLIT_SEPARATOR_CLASS} />
        <ThreadDetailsControl
          size="sm"
          variant="ghost"
          part="secondary"
          aria-expanded={expanded}
          aria-label={
            expanded
              ? t("chat.lineageCollapseWorkflow", { label })
              : t("chat.lineageExpandWorkflow", { label })
          }
          onClick={() => setExpanded((value) => !value)}
        >
          <ChevronDownIcon
            aria-hidden
            className={cn(
              "size-3.5 text-muted-foreground transition-transform",
              expanded && "rotate-180",
            )}
          />
        </ThreadDetailsControl>
      </div>
      {expanded ? (
        <ul className="m-0 list-none p-0 ps-6.5">
          {phases.map((phase) => {
            const open = phaseOpen.get(phase.index) ?? phase.state === "running";
            const status = phaseStatusLabel(phase);
            return (
              <li key={phase.index}>
                <CollapsibleSectionHeader
                  variant="panel"
                  tone={phase.state === "running" ? "emphasized" : "muted"}
                  expanded={open}
                  aria-label={
                    open
                      ? t("chat.lineageCollapsePhase", {
                          phase: phase.title,
                          status: t(PHASE_STATUS_LABEL_KEYS[status]),
                        })
                      : t("chat.lineageExpandPhase", {
                          phase: phase.title,
                          status: t(PHASE_STATUS_LABEL_KEYS[status]),
                        })
                  }
                  onClick={() => setPhaseOpen((phases) => new Map(phases).set(phase.index, !open))}
                  accessory={
                    <>
                      {status === "failed" ? (
                        <SectionHeaderStatus>{t("chat.lineagePhaseFailed")}</SectionHeaderStatus>
                      ) : null}
                      <span className="shrink-0 text-2xs font-normal tabular-nums">
                        {phase.settledCount}/{phase.members.length}{" "}
                        {t("chat.lineagePhaseAgents", { count: phase.members.length })}
                      </span>
                      <span className="shrink-0 text-2xs font-normal tabular-nums empty:hidden">
                        <AgentElapsed agent={phaseElapsed(phase)} />
                      </span>
                    </>
                  }
                >
                  {phase.title}
                </CollapsibleSectionHeader>
                {open ? (
                  <ul className="m-0 list-none p-0">
                    {phase.members.map((member) => (
                      <WorkflowMemberRow
                        key={member.id}
                        member={member}
                        providerInstanceId={providerInstanceId}
                        provider={provider}
                        providers={providers}
                        driver={driver}
                        onOpen={onOpenThread}
                        isThreadAvailable={isThreadAvailable}
                      />
                    ))}
                  </ul>
                ) : null}
              </li>
            );
          })}
          {group.unphasedMembers.map((member) => (
            <WorkflowMemberRow
              key={member.id}
              member={member}
              providerInstanceId={providerInstanceId}
              provider={provider}
              providers={providers}
              driver={driver}
              onOpen={onOpenThread}
              isThreadAvailable={isThreadAvailable}
            />
          ))}
          {phases.length === 0 && group.unphasedMembers.length === 0 ? (
            <li className="px-2.5 py-1.5 text-2xs text-muted-foreground/70">
              {t("chat.lineageNoAgentsYet")}
            </li>
          ) : null}
        </ul>
      ) : null}
    </li>
  );
}
