import {
  AuthOrchestrationOperateScope,
  AuthProvidersManageScope,
  AuthOrchestrationReadScope,
} from "@t3tools/contracts";
import { useEnvironmentScope, readEnvironmentScope } from "~/state/session";
import type {
  AcpRegistryConfigurableProvider,
  AcpRegistrySession,
  EnvironmentId,
  ProjectId,
  ProviderInstanceId,
  ServerProvider,
} from "@t3tools/contracts";
import {
  isAtomCommandInterrupted,
  squashAtomCommandFailure,
  type AtomCommandResult,
} from "@t3tools/client-runtime/state/runtime";
import { useState } from "react";

import { ensureLocalApi } from "../../localApi";
import { serverEnvironment } from "../../state/server";
import { useAtomCommand } from "../../state/use-atom-command";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Select, SelectItem, SelectPopup, SelectTrigger, SelectValue } from "../ui/select";
import { toastManager } from "../ui/toast";
import { SettingsRow } from "./settingsLayout";
import { currentTranslator, useT } from "../../i18n/I18nProvider";

interface AcpSessionProject {
  readonly id: ProjectId;
  readonly title: string;
  readonly workspaceRoot: string;
}

function reportFailure(title: string, result: AtomCommandResult<unknown, unknown>) {
  if (result._tag !== "Failure" || isAtomCommandInterrupted(result)) return;
  const error = squashAtomCommandFailure(result);
  toastManager.add({
    type: "error",
    title,
    description:
      error instanceof Error ? error.message : currentTranslator()("settingsA.acpFailedOperation"),
  });
}

export function AcpSessionManagementSection(props: {
  readonly environmentId: EnvironmentId;
  readonly instanceId: ProviderInstanceId;
  readonly provider: ServerProvider;
  readonly projects: ReadonlyArray<AcpSessionProject>;
  readonly readOnly: boolean;
}) {
  const t = useT();
  const canOperate = useEnvironmentScope(props.environmentId, AuthOrchestrationOperateScope);
  const canRead = useEnvironmentScope(props.environmentId, AuthOrchestrationReadScope);
  const [projectId, setProjectId] = useState<ProjectId | null>(props.projects[0]?.id ?? null);
  const [sessions, setSessions] = useState<ReadonlyArray<AcpRegistrySession>>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [importingSessionId, setImportingSessionId] = useState<string | null>(null);
  const [deletingSessionId, setDeletingSessionId] = useState<string | null>(null);
  const [loggingOut, setLoggingOut] = useState(false);
  const [providers, setProviders] = useState<ReadonlyArray<AcpRegistryConfigurableProvider>>([]);
  const [loadingProviders, setLoadingProviders] = useState(false);
  const [savingProviderId, setSavingProviderId] = useState<string | null>(null);
  const [providerDrafts, setProviderDrafts] = useState<
    Readonly<Record<string, { apiType: string; baseUrl: string; headers: string }>>
  >({});
  const listSessions = useAtomCommand(serverEnvironment.listAcpRegistrySessions, {
    reportFailure: false,
  });
  const importSession = useAtomCommand(serverEnvironment.importAcpRegistrySession, {
    reportFailure: false,
  });
  const deleteSession = useAtomCommand(serverEnvironment.deleteAcpRegistrySession, {
    reportFailure: false,
  });
  const listProviders = useAtomCommand(serverEnvironment.listAcpRegistryProviders, {
    reportFailure: false,
  });
  const setProvider = useAtomCommand(serverEnvironment.setAcpRegistryProvider, {
    reportFailure: false,
  });
  const disableProvider = useAtomCommand(serverEnvironment.disableAcpRegistryProvider, {
    reportFailure: false,
  });
  const logout = useAtomCommand(serverEnvironment.logoutAcpRegistry, { reportFailure: false });
  const canList = props.provider.nativeSessions?.canList === true;
  const canImport =
    props.provider.nativeSessions?.canLoad === true ||
    props.provider.nativeSessions?.canResume === true;
  const canLogout =
    props.provider.auth.canLogout === true && !props.provider.setup?.canAuthenticate;
  const canDelete = props.provider.nativeSessions?.canDelete === true;
  const canConfigureProviders = props.provider.configurableProviders === true;
  const projectOperationPending =
    loading ||
    importingSessionId !== null ||
    deletingSessionId !== null ||
    loadingProviders ||
    savingProviderId !== null;

  if (!canList && !canLogout && !canConfigureProviders) return null;

  const loadSessions = async (cursor?: string) => {
    if (projectId === null || loading) return;
    setLoading(true);
    const result = await listSessions({
      environmentId: props.environmentId,
      input: {
        instanceId: props.instanceId,
        projectId,
        ...(cursor === undefined ? {} : { cursor }),
      },
    });
    setLoading(false);
    if (result._tag === "Success") {
      setSessions((current) =>
        cursor === undefined ? result.value.sessions : [...current, ...result.value.sessions],
      );
      setNextCursor(result.value.nextCursor);
      return;
    }
    reportFailure(t("settingsA.acpCouldNotListSessions"), result);
  };

  const importNativeSession = async (session: AcpRegistrySession) => {
    if (
      !readEnvironmentScope(props.environmentId, AuthOrchestrationOperateScope) ||
      projectId === null ||
      importingSessionId !== null
    )
      return;
    setImportingSessionId(session.sessionId);
    const result = await importSession({
      environmentId: props.environmentId,
      input: {
        instanceId: props.instanceId,
        projectId,
        sessionId: session.sessionId,
        title: session.title,
        updatedAt: session.updatedAt,
      },
    });
    setImportingSessionId(null);
    if (result._tag === "Success") {
      setSessions((current) =>
        current.map((candidate) =>
          candidate.sessionId === session.sessionId
            ? { ...candidate, importedThreadId: result.value.threadId }
            : candidate,
        ),
      );
      toastManager.add({
        type: "success",
        title: result.value.imported
          ? t("settingsA.acpSessionImported")
          : t("settingsA.acpSessionAlreadyImported"),
      });
      return;
    }
    reportFailure(t("settingsA.acpCouldNotImportSession"), result);
  };

  const deleteNativeSession = async (session: AcpRegistrySession) => {
    if (projectId === null || deletingSessionId !== null || session.importedThreadId !== null)
      return;
    const confirmed = await ensureLocalApi().dialogs.confirm(
      t("settingsA.acpConfirmDeleteSession", { name: session.title ?? session.sessionId }),
      { variant: "destructive" },
    );
    if (!confirmed || !readEnvironmentScope(props.environmentId, AuthOrchestrationOperateScope))
      return;
    setDeletingSessionId(session.sessionId);
    const result = await deleteSession({
      environmentId: props.environmentId,
      input: { instanceId: props.instanceId, projectId, sessionId: session.sessionId },
    });
    setDeletingSessionId(null);
    if (result._tag === "Success") {
      setSessions((current) =>
        current.filter((candidate) => candidate.sessionId !== session.sessionId),
      );
      toastManager.add({ type: "success", title: t("settingsA.acpSessionDeleted") });
      return;
    }
    reportFailure(t("settingsA.acpCouldNotDeleteSession"), result);
  };

  const loadProviders = async () => {
    if (projectId === null || loadingProviders) return;
    setLoadingProviders(true);
    const result = await listProviders({
      environmentId: props.environmentId,
      input: { instanceId: props.instanceId, projectId },
    });
    setLoadingProviders(false);
    if (result._tag === "Success") {
      setProviders(result.value.providers);
      setProviderDrafts(
        Object.fromEntries(
          result.value.providers.map((provider) => [
            provider.providerId,
            {
              apiType: provider.current?.apiType ?? provider.supported[0] ?? "",
              baseUrl: provider.current?.baseUrl ?? "",
              headers: "",
            },
          ]),
        ),
      );
      return;
    }
    reportFailure(t("settingsA.acpCouldNotListProviders"), result);
  };

  const saveProvider = async (provider: AcpRegistryConfigurableProvider) => {
    if (
      !readEnvironmentScope(props.environmentId, AuthProvidersManageScope) ||
      projectId === null ||
      savingProviderId !== null
    )
      return;
    const draft = providerDrafts[provider.providerId];
    if (draft === undefined || draft.apiType.length === 0 || draft.baseUrl.length === 0) return;
    let headers: Record<string, string> | undefined;
    if (draft.headers.trim().length > 0) {
      try {
        const parsed: unknown = JSON.parse(draft.headers);
        if (
          typeof parsed !== "object" ||
          parsed === null ||
          Array.isArray(parsed) ||
          !Object.values(parsed).every((value) => typeof value === "string")
        ) {
          throw new Error(t("settingsA.acpHeadersMustBeObject"));
        }
        headers = parsed as Record<string, string>;
      } catch (error) {
        toastManager.add({
          type: "error",
          title: t("settingsA.acpInvalidProviderHeaders"),
          description:
            error instanceof Error ? error.message : t("settingsA.acpHeadersMustBeValidJson"),
        });
        return;
      }
    }
    setSavingProviderId(provider.providerId);
    const result = await setProvider({
      environmentId: props.environmentId,
      input: {
        instanceId: props.instanceId,
        projectId,
        providerId: provider.providerId,
        apiType: draft.apiType,
        baseUrl: draft.baseUrl,
        ...(headers === undefined ? {} : { headers }),
      },
    });
    setSavingProviderId(null);
    if (result._tag === "Success") {
      toastManager.add({ type: "success", title: t("settingsA.acpProviderConfigured") });
      await loadProviders();
      return;
    }
    reportFailure(t("settingsA.acpCouldNotConfigureProvider"), result);
  };

  const disableConfiguredProvider = async (provider: AcpRegistryConfigurableProvider) => {
    if (projectId === null || savingProviderId !== null || provider.required) return;
    const confirmed = await ensureLocalApi().dialogs.confirm(
      t("settingsA.acpConfirmDisableProvider", { providerId: provider.providerId }),
      { variant: "destructive" },
    );
    if (!confirmed || !readEnvironmentScope(props.environmentId, AuthProvidersManageScope)) return;
    setSavingProviderId(provider.providerId);
    const result = await disableProvider({
      environmentId: props.environmentId,
      input: { instanceId: props.instanceId, projectId, providerId: provider.providerId },
    });
    setSavingProviderId(null);
    if (result._tag === "Success") {
      toastManager.add({ type: "success", title: t("settingsA.acpProviderDisabled") });
      await loadProviders();
      return;
    }
    reportFailure(t("settingsA.acpCouldNotDisableProvider"), result);
  };

  const logoutProvider = async () => {
    if (loggingOut || !readEnvironmentScope(props.environmentId, AuthProvidersManageScope)) return;
    setLoggingOut(true);
    const result = await logout({
      environmentId: props.environmentId,
      input: { instanceId: props.instanceId },
    });
    setLoggingOut(false);
    if (result._tag === "Success") {
      setSessions([]);
      setNextCursor(null);
      toastManager.add({ type: "success", title: t("settingsA.acpLoggedOut") });
      return;
    }
    reportFailure(t("settingsA.acpCouldNotLogOut"), result);
  };

  return (
    <div className="grid gap-3">
      <SettingsRow
        title={t("settingsA.acpNativeSessionsTitle")}
        description={t("settingsA.acpNativeSessionsDescription")}
        status={
          canList && props.projects.length === 0
            ? t("settingsA.acpAddProjectBeforeImport")
            : undefined
        }
        control={
          <div className="flex flex-wrap items-center gap-2">
            {canLogout ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={props.readOnly || loggingOut}
                onClick={() => void logoutProvider()}
              >
                {loggingOut ? t("settingsA.acpLoggingOut") : t("settingsA.acpLogOut")}
              </Button>
            ) : null}
            {canList && props.projects.length > 0 ? (
              <>
                <Select
                  value={projectId ?? ""}
                  disabled={!canRead || projectOperationPending}
                  onValueChange={(value) => {
                    if (value === null) return;
                    setProjectId(value as ProjectId);
                    setSessions([]);
                    setNextCursor(null);
                    setProviders([]);
                    setProviderDrafts({});
                  }}
                >
                  <SelectTrigger
                    aria-label={t("settingsA.acpProjectForSessions")}
                    className="w-40"
                    size="sm"
                  >
                    <SelectValue>
                      {props.projects.find((project) => project.id === projectId)?.title}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectPopup>
                    {props.projects.map((project) => (
                      <SelectItem key={project.id} value={project.id}>
                        {project.title}
                      </SelectItem>
                    ))}
                  </SelectPopup>
                </Select>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={!canRead || loading || projectId === null}
                  onClick={() => void loadSessions()}
                >
                  {loading
                    ? t("settingsA.acpLoading")
                    : sessions.length === 0
                      ? t("settingsA.acpListSessions")
                      : t("common.refresh")}
                </Button>
              </>
            ) : null}
          </div>
        }
      >
        {canList && (sessions.length > 0 || nextCursor !== null) ? (
          <>
            {sessions.length > 0 ? (
              <div className="divide-y divide-border/60 border-y border-border/60">
                {sessions.map((session) => (
                  <div
                    key={session.sessionId}
                    className="flex min-w-0 items-center justify-between gap-3 py-2"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-xs text-foreground">
                        {session.title ?? session.sessionId}
                      </p>
                      <code className="block truncate text-3xs text-muted-foreground">
                        {session.sessionId}
                      </code>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <Button
                        type="button"
                        size="xs"
                        variant="ghost-muted"
                        disabled={
                          !canOperate ||
                          !canImport ||
                          session.importedThreadId !== null ||
                          importingSessionId !== null
                        }
                        onClick={() => void importNativeSession(session)}
                      >
                        {session.importedThreadId !== null
                          ? t("settingsA.acpImported")
                          : importingSessionId === session.sessionId
                            ? t("settingsA.acpImporting")
                            : t("settingsA.acpImport")}
                      </Button>
                      {canDelete ? (
                        <Button
                          type="button"
                          size="xs"
                          variant="ghost-muted"
                          disabled={
                            !canOperate ||
                            session.importedThreadId !== null ||
                            deletingSessionId !== null
                          }
                          onClick={() => void deleteNativeSession(session)}
                        >
                          {deletingSessionId === session.sessionId
                            ? t("settingsA.acpDeleting")
                            : t("settingsA.acpDelete")}
                        </Button>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            ) : null}

            {nextCursor !== null ? (
              <Button
                type="button"
                size="xs"
                variant="ghost-muted"
                className="w-fit"
                disabled={!canRead || loading}
                onClick={() => void loadSessions(nextCursor)}
              >
                {loading ? t("settingsA.acpLoading") : t("settingsA.acpLoadMore")}
              </Button>
            ) : null}
          </>
        ) : null}
      </SettingsRow>

      {canConfigureProviders ? (
        <div className="grid gap-3 border-t border-border/60 px-3 py-3 sm:px-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-xs font-medium text-foreground">
                {t("settingsA.acpAgentProviders")}
              </p>
              <p className="text-xs text-muted-foreground">
                {t("settingsA.acpProviderDescription")}
              </p>
            </div>
            <Button
              type="button"
              size="xs"
              variant="outline"
              disabled={!canRead || loadingProviders || projectId === null}
              onClick={() => void loadProviders()}
            >
              {loadingProviders
                ? t("settingsA.acpLoading")
                : providers.length === 0
                  ? t("settingsA.acpListProviders")
                  : t("common.refresh")}
            </Button>
          </div>

          {!canList && props.projects.length > 1 ? (
            <Select
              value={projectId ?? ""}
              disabled={!canRead || projectOperationPending}
              onValueChange={(value) => {
                if (value === null) return;
                setProjectId(value as ProjectId);
                setProviders([]);
                setProviderDrafts({});
              }}
            >
              <SelectTrigger
                aria-label={t("settingsA.acpProjectForProviders")}
                className="min-w-48"
                size="xs"
              >
                <SelectValue>
                  {props.projects.find((project) => project.id === projectId)?.title}
                </SelectValue>
              </SelectTrigger>
              <SelectPopup>
                {props.projects.map((project) => (
                  <SelectItem key={project.id} value={project.id}>
                    {project.title}
                  </SelectItem>
                ))}
              </SelectPopup>
            </Select>
          ) : null}

          {providers.length > 0 ? (
            <div className="divide-y divide-border/60 border-y border-border/60">
              {providers.map((provider) => {
                const draft = providerDrafts[provider.providerId] ?? {
                  apiType: provider.current?.apiType ?? provider.supported[0] ?? "",
                  baseUrl: provider.current?.baseUrl ?? "",
                  headers: "",
                };
                const updateDraft = (update: Partial<typeof draft>) =>
                  setProviderDrafts((current) => ({
                    ...current,
                    [provider.providerId]: { ...draft, ...update },
                  }));
                return (
                  <div key={provider.providerId} className="grid gap-2 py-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-xs font-medium text-foreground">
                          {provider.providerId}
                        </p>
                        <p className="text-3xs text-muted-foreground">
                          {provider.current === null
                            ? t("settingsA.acpDisabled")
                            : t("settingsA.acpConfigured")}
                          {provider.required ? t("settingsA.acpRequiredSuffix") : ""}
                        </p>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          type="button"
                          size="xs"
                          variant="outline"
                          disabled={
                            props.readOnly ||
                            savingProviderId !== null ||
                            draft.apiType.length === 0 ||
                            draft.baseUrl.length === 0
                          }
                          onClick={() => void saveProvider(provider)}
                        >
                          {savingProviderId === provider.providerId
                            ? t("settingsA.acpSaving")
                            : t("settingsA.acpSave")}
                        </Button>
                        {!provider.required && provider.current !== null ? (
                          <Button
                            type="button"
                            size="xs"
                            variant="ghost-muted"
                            disabled={props.readOnly || savingProviderId !== null}
                            onClick={() => void disableConfiguredProvider(provider)}
                          >
                            {t("settingsA.acpDisable")}
                          </Button>
                        ) : null}
                      </div>
                    </div>
                    <div className="grid gap-2 sm:grid-cols-[9rem_minmax(0,1fr)]">
                      <Select
                        value={draft.apiType}
                        disabled={props.readOnly || savingProviderId !== null}
                        onValueChange={(value) => {
                          if (value !== null) updateDraft({ apiType: value });
                        }}
                      >
                        <SelectTrigger
                          aria-label={t("settingsA.acpProviderProtocolLabel", {
                            provider: provider.providerId,
                          })}
                          size="sm"
                        >
                          <SelectValue>{draft.apiType}</SelectValue>
                        </SelectTrigger>
                        <SelectPopup>
                          {provider.supported.map((protocol) => (
                            <SelectItem key={protocol} value={protocol}>
                              {protocol}
                            </SelectItem>
                          ))}
                        </SelectPopup>
                      </Select>
                      <Input
                        size="sm"
                        type="url"
                        aria-label={t("settingsA.acpProviderBaseUrlLabel", {
                          provider: provider.providerId,
                        })}
                        // i18n-ignore: example URL, not UI text
                        placeholder="https://api.example.com"
                        value={draft.baseUrl}
                        disabled={props.readOnly || savingProviderId !== null}
                        onValueChange={(value) => updateDraft({ baseUrl: value })}
                      />
                    </div>
                    <Input
                      size="sm"
                      type="password"
                      aria-label={t("settingsA.acpProviderHeadersLabel", {
                        provider: provider.providerId,
                      })}
                      placeholder={t("settingsA.acpHeadersPlaceholder", {
                        example: '{"Authorization":"Bearer …"}',
                      })}
                      value={draft.headers}
                      disabled={props.readOnly || savingProviderId !== null}
                      onValueChange={(value) => updateDraft({ headers: value })}
                    />
                  </div>
                );
              })}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
