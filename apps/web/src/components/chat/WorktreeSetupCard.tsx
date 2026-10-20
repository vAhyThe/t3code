import type { Translate } from "@t3tools/client-runtime/i18n";
import type { WorktreeSetupSnapshot, WorktreeSetupStage } from "@t3tools/contracts";
import { formatDuration } from "@t3tools/shared/orchestrationTiming";
import {
  CheckIcon,
  CircleAlertIcon,
  CircleIcon,
  LaptopIcon,
  MinusIcon,
  TerminalIcon,
  XIcon,
} from "lucide-react";
import { ChevronDown, ChevronRight } from "lucide";
import { useEffect, useState, type ReactNode } from "react";

import { Button } from "~/components/ui/button";
import { MorphIcon } from "~/components/MorphIcon";
import { Spinner } from "~/components/ui/spinner";
import { MiddleTruncate } from "../ui/middle-truncate";
import { observeVisibleAnimation } from "~/lib/visibleAnimation";
import { cn } from "~/lib/utils";
import { WorkLogRow } from "./WorkLog";
import { useT } from "~/i18n/I18nProvider";

interface WorktreeSetupCardProps {
  snapshot: WorktreeSetupSnapshot;
  onCancel: (() => void) | null;
  onWorkLocally: (() => void) | null;
  onOpenTerminal: (() => void) | null;
}

function stageElapsedMs(stage: WorktreeSetupStage, nowMs: number): number | null {
  if (!stage.startedAt) return null;
  const start = Date.parse(stage.startedAt);
  const end = stage.endedAt ? Date.parse(stage.endedAt) : nowMs;
  if (!Number.isFinite(start) || !Number.isFinite(end)) return null;
  return Math.max(0, end - start);
}

function useNowWhile(active: boolean): number {
  const [nowMs, setNowMs] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => setNowMs(Date.now()), 1_000);
    return () => clearInterval(id);
  }, [active]);
  return nowMs;
}

function StageIcon({ status }: { status: WorktreeSetupStage["status"] }) {
  const className = "size-4 shrink-0 stroke-2";
  switch (status) {
    case "done":
      return <CheckIcon aria-hidden className={className} />;
    case "running":
      return <Spinner size="md" className="shrink-0" />;
    case "failed":
      return <XIcon aria-hidden className={className} />;
    case "warning":
      return <CircleAlertIcon aria-hidden className={className} />;
    case "skipped":
      return <MinusIcon aria-hidden className={className} />;
    case "pending":
      return <CircleIcon aria-hidden className={className} />;
  }
}

function stageRowClassName(status: WorktreeSetupStage["status"]): string {
  switch (status) {
    case "failed":
      return "text-destructive-foreground";
    case "warning":
      return "text-warning-foreground";
    case "pending":
      return "text-secondary-label opacity-40";
    case "running":
    case "skipped":
    case "done":
      return "text-secondary-label";
  }
}

function ShimmerOverlay({ children }: { children: ReactNode }) {
  return (
    <span
      aria-hidden
      className="live-activity-focus pointer-events-none absolute inset-y-0 select-none"
    >
      <span className="live-activity-focus-counter block">
        <span className="live-activity-focus-aligned block text-foreground">{children}</span>
      </span>
    </span>
  );
}

function headerLabel(snapshot: WorktreeSetupSnapshot, t: Translate): string {
  switch (snapshot.phase) {
    case "running":
      return t("chat.worktreeSetupRunning");
    case "done":
      return snapshot.stages.some((stage) => stage.status === "failed")
        ? t("chat.worktreeSetupReadyScriptFailed")
        : t("chat.worktreeSetupReady");
    case "failed":
      return t("chat.worktreeSetupFailed");
    case "cancelled":
      return t("chat.worktreeSetupCancelled");
  }
}

// Mirrors worktreeSetupStageLabel from contracts, translated at render.
function stageLabel(id: WorktreeSetupStage["id"], t: Translate): string {
  switch (id) {
    case "fetch":
      return t("chat.worktreeStageFetch");
    case "checkout":
      return t("chat.worktreeStageCheckout");
    case "submodules":
      return t("chat.worktreeStageSubmodules");
    case "setup-script":
      return t("chat.worktreeStageSetupScript");
    case "agent":
      return t("chat.worktreeStageAgent");
  }
}

function SetupHeaderRow({
  snapshot,
  totalElapsed,
}: {
  snapshot: WorktreeSetupSnapshot;
  totalElapsed: number | null;
}) {
  const t = useT();
  const running = snapshot.phase === "running";
  const failed = snapshot.phase === "failed";
  const finishedWithFailedStage =
    snapshot.phase === "done" && snapshot.stages.some((stage) => stage.status === "failed");
  const text = headerLabel(snapshot, t);
  const tone = failed
    ? "text-destructive-foreground"
    : finishedWithFailedStage
      ? "text-warning-foreground"
      : "text-muted-foreground";
  return (
    <div className="border-b border-border/60 pb-2 pt-1">
      <div
        className={cn(
          "flex h-6 min-w-0 items-baseline gap-2 px-1 text-sm leading-relaxed tabular-nums",
          tone,
        )}
      >
        <span
          ref={running ? observeVisibleAnimation : undefined}
          className="relative min-w-0 shrink overflow-hidden whitespace-nowrap"
        >
          <span className="block truncate">{text}</span>
          {running ? <ShimmerOverlay>{text}</ShimmerOverlay> : null}
        </span>
        {totalElapsed !== null ? (
          <span className="ml-auto shrink-0 text-xs text-muted-foreground">
            {formatDuration(totalElapsed)}
          </span>
        ) : null}
      </div>
    </div>
  );
}

function StageRow({
  stage,
  nowMs,
  scriptName,
}: {
  stage: WorktreeSetupStage;
  nowMs: number;
  scriptName: string | null;
}) {
  const t = useT();
  const elapsed = stageElapsedMs(stage, nowMs);
  const label = stage.id === "setup-script" && scriptName ? scriptName : stageLabel(stage.id, t);
  const running = stage.status === "running";
  const trailing =
    stage.status === "pending"
      ? null
      : stage.status === "skipped"
        ? (stage.detail ?? t("chat.worktreeStageSkipped"))
        : stage.id === "checkout" && running && stage.percent !== null
          ? `${stage.percent}%`
          : stage.detail;
  return (
    <WorkLogRow
      data-worktree-setup-stage={stage.id}
      data-worktree-setup-status={stage.status}
      icon={
        <span className={cn("text-icon-muted", stage.status === "pending" && "opacity-40")}>
          <StageIcon status={stage.status} />
        </span>
      }
      label={
        <span
          ref={running ? observeVisibleAnimation : undefined}
          className={cn("relative block truncate", stageRowClassName(stage.status))}
        >
          {label}
          {running ? <ShimmerOverlay>{label}</ShimmerOverlay> : null}
        </span>
      }
      trailing={
        <>
          {trailing ? (
            <span className="min-w-0 truncate text-xs text-muted-foreground tabular-nums">
              {trailing}
            </span>
          ) : null}
          {elapsed !== null && stage.status !== "skipped" && stage.status !== "pending" ? (
            <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
              {formatDuration(elapsed)}
            </span>
          ) : null}
        </>
      }
    />
  );
}

const OUTPUT_TAIL_LINES = 4;
const OUTPUT_TAIL_SLOTS = Array.from({ length: OUTPUT_TAIL_LINES }, (_, slot) => slot);

function OutputTail({ lines, failed }: { lines: ReadonlyArray<string>; failed: boolean }) {
  const rows = OUTPUT_TAIL_SLOTS.map((slot) => ({
    slot,
    line: lines[lines.length - OUTPUT_TAIL_LINES + slot] ?? "",
  }));
  return (
    <pre
      className={cn(
        "mb-1 ml-8 overflow-hidden rounded-md border px-2.5 py-1.5 font-mono text-2xs leading-relaxed select-text",
        failed
          ? "border-destructive/20 bg-error-surface text-destructive-foreground"
          : "border-border bg-code text-muted-foreground",
      )}
    >
      {rows.map(({ slot, line }) => (
        <div key={slot} className="truncate whitespace-pre">
          {line.length === 0 ? "\u00a0" : line}
        </div>
      ))}
    </pre>
  );
}

function SetupDetails({ snapshot }: { snapshot: WorktreeSetupSnapshot }) {
  const t = useT();
  return (
    <dl className="mt-1 mb-1.5 ml-8 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
      {snapshot.branch ? (
        <>
          <dt className="text-foreground/80">{t("chat.worktreeDetailsBranch")}</dt>
          <dd className="min-w-0 font-mono">
            <MiddleTruncate value={snapshot.branch} className="flex" />
          </dd>
        </>
      ) : null}
      {snapshot.baseRef ? (
        <>
          <dt className="text-foreground/80">{t("chat.worktreeDetailsBase")}</dt>
          <dd className="min-w-0 font-mono">
            <MiddleTruncate value={snapshot.baseRef} className="flex" />
          </dd>
        </>
      ) : null}
      {snapshot.worktreePath ? (
        <>
          <dt className="text-foreground/80">{t("chat.worktreeDetailsPath")}</dt>
          <dd className="min-w-0 font-mono">
            <MiddleTruncate value={snapshot.worktreePath} className="flex" />
          </dd>
        </>
      ) : null}
      {snapshot.setupScript ? (
        <>
          <dt className="text-foreground/80">{t("chat.worktreeDetailsSetup")}</dt>
          <dd className="truncate font-mono">{snapshot.setupScript.command}</dd>
        </>
      ) : null}
    </dl>
  );
}

function CollapsedSummaryRow({
  snapshot,
  totalElapsed,
}: {
  snapshot: WorktreeSetupSnapshot;
  totalElapsed: number | null;
}) {
  const t = useT();
  const status: WorktreeSetupStage["status"] =
    snapshot.phase === "failed" || snapshot.phase === "cancelled"
      ? "failed"
      : snapshot.stages.some((stage) => stage.id === "setup-script" && stage.status === "failed")
        ? "failed"
        : "done";
  const label = headerLabel(snapshot, t);
  return (
    <WorkLogRow
      data-worktree-setup-stage="summary"
      data-worktree-setup-status={status}
      icon={
        <span className="text-icon-muted">
          <StageIcon status={status} />
        </span>
      }
      label={<span className={stageRowClassName(status)}>{label}</span>}
      trailing={
        totalElapsed !== null ? (
          <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
            {formatDuration(totalElapsed)}
          </span>
        ) : null
      }
    />
  );
}

export function WorktreeSetupCard({
  snapshot,
  onCancel,
  onWorkLocally,
  onOpenTerminal,
  embedded = false,
}: WorktreeSetupCardProps & {
  embedded?: boolean;
}) {
  const t = useT();
  const running = snapshot.phase === "running";
  const nowMs = useNowWhile(running);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const totalElapsed = (() => {
    const start = Date.parse(snapshot.startedAt);
    const end = snapshot.endedAt ? Date.parse(snapshot.endedAt) : nowMs;
    return Number.isFinite(start) && Number.isFinite(end) ? Math.max(0, end - start) : null;
  })();
  const setupStage = snapshot.stages.find((stage) => stage.id === "setup-script");
  const showTerminal = onOpenTerminal && setupStage && setupStage.status !== "pending";
  const collapsed = embedded && !running;
  const showHeader = !embedded && !running && snapshot.phase !== "done";
  const showTail =
    setupStage !== undefined &&
    (setupStage.status === "failed" ||
      (setupStage.status === "running" && setupStage.tail.length > 0));

  return (
    <section aria-label={t("chat.worktreeSetupAria")} data-worktree-setup-phase={snapshot.phase}>
      {showHeader ? <SetupHeaderRow snapshot={snapshot} totalElapsed={totalElapsed} /> : null}
      {collapsed ? (
        <CollapsedSummaryRow snapshot={snapshot} totalElapsed={totalElapsed} />
      ) : (
        <div className={showHeader ? "pt-1.5" : undefined}>
          {snapshot.stages.map((stage) => (
            <div key={stage.id}>
              <StageRow
                stage={stage}
                nowMs={nowMs}
                scriptName={snapshot.setupScript?.name ?? null}
              />
              {stage.id === "setup-script" && showTail ? (
                <OutputTail lines={stage.tail} failed={stage.status === "failed"} />
              ) : null}
            </div>
          ))}
        </div>
      )}

      {snapshot.phase === "failed" && snapshot.error ? (
        <p className="mt-1 ml-8 text-xs text-muted-foreground">{snapshot.error}</p>
      ) : null}

      {detailsOpen ? <SetupDetails snapshot={snapshot} /> : null}

      <div className="mt-0.5 ml-[calc(--spacing(6)+2px-(--spacing(2)-1px))] flex flex-wrap items-center gap-0.5">
        <Button
          type="button"
          size="xs"
          variant="ghost-muted"
          aria-expanded={detailsOpen}
          onClick={() => setDetailsOpen((open) => !open)}
        >
          <MorphIcon aria-hidden icon={detailsOpen ? ChevronDown : ChevronRight} />
          {t("chat.worktreeSetupDetails")}
        </Button>
        {showTerminal ? (
          <Button type="button" size="xs" variant="ghost-muted" onClick={onOpenTerminal}>
            <TerminalIcon aria-hidden />
            {t("chat.worktreeSetupOpenTerminal")}
          </Button>
        ) : null}
        {onWorkLocally ? (
          <Button type="button" size="xs" variant="ghost-muted" onClick={onWorkLocally}>
            <LaptopIcon aria-hidden />
            {t("chat.worktreeSetupWorkLocally")}
          </Button>
        ) : null}
        {onCancel && running ? (
          <Button type="button" size="xs" variant="ghost-muted" onClick={onCancel}>
            <XIcon aria-hidden />
            {t("common.cancel")}
          </Button>
        ) : null}
      </div>
    </section>
  );
}
