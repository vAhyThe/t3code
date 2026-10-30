import { currentTranslator } from "~/i18n/I18nProvider";
import { pipe } from "effect/Function";
import { ACP_REGISTRY_MAX_AGENTS, AuthProvidersManageScope } from "@t3tools/contracts";
import { readEnvironmentScope, useEnvironmentScope } from "../../state/session";
import {
  isAtomCommandInterrupted,
  squashAtomCommandFailure,
} from "@t3tools/client-runtime/state/runtime";
import type {
  AcpRegistryPrepareResult,
  AcpRegistrySearchAgent,
  EnvironmentId,
  ProviderInstanceConfig,
} from "@t3tools/contracts";
import { ExternalLinkIcon, SearchIcon } from "lucide-react";
import { type FormEvent, useState } from "react";

import { useDeadlinePassed } from "../../hooks/useDeadline";
import { serverEnvironment } from "../../state/server";
import { useEnvironmentQuery } from "../../state/query";
import { useAtomCommand } from "../../state/use-atom-command";
import { Alert, AlertDescription } from "../ui/alert";
import { Button } from "../ui/button";
import { InputGroup, InputGroupAddon, InputGroupInput } from "../ui/input-group";
import { ScrollArea } from "../ui/scroll-area";
import { Tooltip, TooltipPopup, TooltipTrigger } from "../ui/tooltip";
import { isConfiguredAcpRegistryAgent } from "./AddProviderInstanceDialog.logic";
import { ProviderDriverKind } from "@t3tools/contracts";
import { ProviderInstanceIcon } from "../chat/ProviderInstanceIcon";
import { useT } from "../../i18n/I18nProvider";
import { providerClients } from "./providerDriverMeta";

function errorMessage(error: unknown): string {
  return error instanceof Error && error.message.trim()
    ? error.message
    : currentTranslator()("settingsA.acpRegistryPrepareFailed");
}

const ACP_REGISTRY_SEARCH_DEBOUNCE_MS = 300;
const FIRST_CLASS_REGISTRY_AGENT_IDS = new Set(
  providerClients.definitions.flatMap((definition) => definition.acpRegistryAgentIds ?? []),
);

function applyAcpRegistryPrepareResult(
  agent: AcpRegistrySearchAgent,
  prepared: AcpRegistryPrepareResult,
): AcpRegistrySearchAgent {
  return {
    ...agent,
    id: prepared.agentId,
    version: prepared.version,
    distribution: prepared.distribution,
  };
}

/**
 * Registry search and agent preparation. Owned by the dialog, which needs the
 * loading and preparing state for its layout and navigation, and rendered by
 * AcpRegistrySearchStep. Pass `enabled: false` while the step is hidden so the
 * search is not kept subscribed.
 */
export function useAcpRegistrySearch(environmentId: EnvironmentId, enabled: boolean) {
  const [input, setInput] = useState<{
    readonly text: string;
    readonly submitted: string;
    readonly typedAt: number | null;
  }>({ text: "", submitted: "", typedAt: null });
  const typingSettled = useDeadlinePassed(
    input.typedAt === null ? null : input.typedAt + ACP_REGISTRY_SEARCH_DEBOUNCE_MS,
  );
  const submittedQuery = typingSettled ? input.text.trim() : input.submitted;
  const [preparingId, setPreparingId] = useState<string | null>(null);
  const [prepareError, setPrepareError] = useState<string | null>(null);
  const search = useEnvironmentQuery(
    enabled
      ? serverEnvironment.searchAcpRegistry({
          environmentId,
          input: submittedQuery
            ? { query: submittedQuery }
            : { query: "", limit: ACP_REGISTRY_MAX_AGENTS },
        })
      : null,
  );
  const prepareAgent = useAtomCommand(serverEnvironment.prepareAcpRegistryAgent, {
    reportFailure: false,
  });

  return {
    query: input.text,
    search,
    preparingId,
    prepareError,
    type: (text: string) => {
      setPrepareError(null);
      setInput({ text, submitted: submittedQuery, typedAt: Date.now() });
    },
    submit: () => {
      const trimmed = input.text.trim();
      setPrepareError(null);
      setInput({ text: trimmed, submitted: trimmed, typedAt: null });
      if (trimmed === submittedQuery) search.refresh();
    },
    prepare: async (
      agent: AcpRegistrySearchAgent,
      onPrepared: (agent: AcpRegistrySearchAgent) => void,
    ) => {
      if (!readEnvironmentScope(environmentId, AuthProvidersManageScope)) return;
      setPrepareError(null);
      setPreparingId(agent.id);
      const result = await prepareAgent({ environmentId, input: { agentId: agent.id } });
      setPreparingId(null);
      if (result._tag === "Success") {
        onPrepared(applyAcpRegistryPrepareResult(agent, result.value));
        return;
      }
      if (!isAtomCommandInterrupted(result)) {
        pipe(squashAtomCommandFailure(result), errorMessage, setPrepareError);
      }
    },
  };
}

export type AcpRegistrySearch = ReturnType<typeof useAcpRegistrySearch>;

interface AcpRegistrySearchStepProps {
  readonly environmentId: EnvironmentId;
  readonly registry: AcpRegistrySearch;
  readonly providerInstances: Readonly<Record<string, ProviderInstanceConfig>>;
  readonly onPrepared: (agent: AcpRegistrySearchAgent) => void;
  readonly onManualConfiguration: () => void;
  readonly onLocalConfiguration?: () => void;
}

export function AcpRegistrySearchStep({
  environmentId,
  registry,
  providerInstances,
  onPrepared,
  onManualConfiguration,
  onLocalConfiguration,
}: AcpRegistrySearchStepProps) {
  const canManageProviders = useEnvironmentScope(environmentId, AuthProvidersManageScope);
  const { query, search, preparingId, prepareError } = registry;

  const handleSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    registry.submit();
  };

  const handlePrepare = (agent: AcpRegistrySearchAgent) => {
    void registry.prepare(agent, onPrepared);
  };

  const results =
    search.data?.agents.filter((agent) => !FIRST_CLASS_REGISTRY_AGENT_IDS.has(agent.id)) ?? null;
  const isInitialSearch = search.isPending && results === null;
  const isRefreshing = search.isPending && results !== null;
  const resultCount = results?.length ?? 0;

  return (
    <section className="grid gap-3" aria-labelledby="acp-registry-search-heading">
      <h3 className="sr-only" id="acp-registry-search-heading">
        {currentTranslator()("settingsA.acpRegistryChooseAgent")}
      </h3>

      <form className="flex flex-wrap items-center gap-2" onSubmit={handleSearch}>
        <InputGroup className="min-w-40 flex-1">
          <InputGroupAddon>
            <SearchIcon />
          </InputGroupAddon>
          <InputGroupInput
            aria-label={currentTranslator()("settingsA.acpRegistrySearchLabel")}
            disabled={preparingId !== null}
            onChange={(event) => registry.type(event.currentTarget.value)}
            placeholder={currentTranslator()("settingsA.acpRegistrySearchPlaceholder")}
            size="sm"
            type="search"
            value={query}
          />
        </InputGroup>
        <Button
          disabled={preparingId !== null}
          onClick={onManualConfiguration}
          size="sm"
          type="button"
          variant="ghost-muted"
        >
          {currentTranslator()("settingsA.acpRegistryEnterManually")}
        </Button>
        {onLocalConfiguration ? (
          <Button
            disabled={preparingId !== null}
            onClick={onLocalConfiguration}
            size="sm"
            type="button"
            variant="outline"
          >
            {currentTranslator()("settingsA.acpRegistryLocalCommand")}
          </Button>
        ) : null}
      </form>

      <div className="sr-only" role="status">
        {isInitialSearch
          ? currentTranslator()("settingsA.acpRegistrySearching")
          : isRefreshing
            ? currentTranslator()("settingsA.acpRegistryRefreshing")
            : results
              ? currentTranslator()("settingsA.acpRegistryResultCount", { count: resultCount })
              : ""}
      </div>

      {search.error || prepareError ? (
        <Alert variant="error" role="status" aria-live="polite">
          <AlertDescription>{prepareError ?? search.error}</AlertDescription>
        </Alert>
      ) : null}

      {isInitialSearch ? (
        <div className="flex min-h-20 items-center justify-center text-sm text-muted-foreground">
          {currentTranslator()("settingsA.acpRegistrySearchingRegistry")}
        </div>
      ) : null}

      {results ? (
        results.length === 0 ? (
          <div className="flex min-h-28 flex-col items-center justify-center rounded-2xl border border-dashed px-4 text-center">
            <p className="text-sm font-medium">
              {currentTranslator()("settingsA.acpRegistryNoResults")}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {currentTranslator()("settingsA.acpRegistryTryBroader")}
            </p>
          </div>
        ) : (
          <ScrollArea scrollFade className="max-h-64">
            <div className="pr-2.5">
              {results.map((agent) => (
                <AcpRegistryAgentRow
                  agent={agent}
                  alreadyAdded={isConfiguredAcpRegistryAgent(providerInstances, agent.id)}
                  canAdd={canManageProviders && preparingId === null}
                  isPreparing={preparingId === agent.id}
                  key={agent.id}
                  onAdd={handlePrepare}
                />
              ))}
            </div>
          </ScrollArea>
        )
      ) : null}
    </section>
  );
}

function AcpRegistryAgentRow({
  agent,
  alreadyAdded,
  canAdd,
  isPreparing,
  onAdd,
}: {
  readonly agent: AcpRegistrySearchAgent;
  readonly alreadyAdded: boolean;
  readonly canAdd: boolean;
  readonly isPreparing: boolean;
  readonly onAdd: (agent: AcpRegistrySearchAgent) => void;
}) {
  const t = useT();
  const progressLabel =
    agent.distribution === "binary"
      ? t("settingsA.acpRegistryDownloading")
      : t("settingsA.acpRegistryPreparing");
  const ariaLabel = alreadyAdded
    ? t("settingsA.acpRegistryAlreadyAddedAria", { name: agent.name })
    : isPreparing
      ? agent.distribution === "binary"
        ? t("settingsA.acpRegistryDownloadingAria", { name: agent.name })
        : t("settingsA.acpRegistryPreparingAria", { name: agent.name })
      : t("settingsA.acpRegistryAddAria", { name: agent.name });
  const aboutUrl = agent.website || agent.repository;
  return (
    <article className="min-w-0 py-2.5">
      <div className="flex min-w-0 items-center justify-between gap-3">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <ProviderInstanceIcon
            driverKind={ProviderDriverKind.make("acpRegistry")}
            displayName={agent.name}
            acpRegistryAgentId={agent.id}
            acpRegistryIconUrl={agent.icon ?? undefined}
            iconClassName="size-6 rounded-md text-muted-foreground"
          />
          <div className="min-w-0 flex-1">
            <div className="flex min-w-0 items-baseline gap-2">
              <h4 className="min-w-0 truncate text-sm font-medium text-foreground">{agent.name}</h4>
            </div>
            {agent.description ? (
              <p className="mt-0.5 truncate text-xs text-muted-foreground">{agent.description}</p>
            ) : null}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          {aboutUrl ? (
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    size="icon-xs"
                    variant="ghost-muted"
                    aria-label={t("settingsA.acpRegistryAboutAgent", { name: agent.name })}
                    render={<a href={aboutUrl} target="_blank" rel="noreferrer" />}
                  >
                    <ExternalLinkIcon />
                  </Button>
                }
              />
              <TooltipPopup>
                {t("settingsA.acpRegistryAboutAgent", { name: agent.name })}
              </TooltipPopup>
            </Tooltip>
          ) : null}
          <Button
            aria-label={ariaLabel}
            disabled={!canAdd || alreadyAdded}
            onClick={() => onAdd(agent)}
            size="xs"
            variant={isPreparing ? "secondary" : "outline"}
          >
            {alreadyAdded
              ? t("settingsA.acpRegistryAdded")
              : isPreparing
                ? progressLabel
                : t("settingsA.acpRegistryAdd")}
          </Button>
        </div>
      </div>
    </article>
  );
}
