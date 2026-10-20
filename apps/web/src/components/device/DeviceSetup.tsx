import { DeviceHostUpdates } from "./DeviceHostUpdates";
import type { DevicePlatform, DeviceServiceState, EnvironmentId } from "@t3tools/contracts";
import { Check } from "lucide-react";
import { Check as CheckGlyph, CircleAlert } from "lucide";
import { AuthSettingsWriteScope } from "@t3tools/contracts";
import type { Translate } from "@t3tools/client-runtime/i18n";
import { useEffect, useState } from "react";

import { Button } from "~/components/ui/button";
import { DialogClose } from "~/components/ui/dialog";
import { MorphIcon } from "~/components/MorphIcon";
import { WizardHeader, WizardPanel, WizardSteps, WizardFooter } from "~/components/ui/wizard";
import { Spinner } from "~/components/ui/spinner";
import { Switch } from "~/components/ui/switch";
import { currentTranslator, useT } from "~/i18n/I18nProvider";
import { deviceEnvironment } from "~/state/device";
import { useAtomCommand } from "~/state/use-atom-command";
import { readEnvironmentScope, useEnvironmentScope } from "~/state/session";
import { cn } from "~/lib/utils";

const platformName = (platform: DevicePlatform) => (platform === "ios" ? "iOS" : "Android");

function DeviceHubDescriptionText() {
  const t = useT();
  return <>{t("shellDevice.deviceHubDescription")}</>;
}

function AgentDeviceDescriptionText() {
  const t = useT();
  return <>{t("shellDevice.agentDeviceDescription")}</>;
}

/** Rendered as a node so consumers keep passing a plain prop and the text follows the locale. */
export const deviceHubDescription = <DeviceHubDescriptionText />;
export const agentDeviceDescription = <AgentDeviceDescriptionText />;

/**
 * `hostStatus` only tracks this machine. A machine without simulator tooling never
 * starts its own hub, so setup and the panel must also count remote device hosts.
 */
export function deviceHubReadiness(state: DeviceServiceState) {
  const statuses = Object.values(state.hostStatuses).map((host) => host.status);
  const ready = state.hostStatus === "ready" || statuses.includes("ready");
  const busy =
    !ready &&
    [state.hostStatus, ...statuses].some(
      (status) => status === "installing" || status === "starting",
    );
  return { ready, busy };
}

export function platformSetupStatus(
  state: DeviceServiceState,
  platform: DevicePlatform,
  t: Translate = currentTranslator(),
) {
  const availabilities = state.hosts.flatMap((host) =>
    host.platforms
      .filter((candidate) => candidate.platform === platform)
      .map((candidate) => ({ ...candidate, host })),
  );
  const supportingHosts = availabilities
    .filter((candidate) => candidate.available)
    .map((candidate) => candidate.host);
  if (supportingHosts.length === 0) {
    return {
      ready: false,
      message:
        availabilities[0]?.reason ??
        t("shellDevice.devicePlatformSupportNotDetected", { platform: platformName(platform) }),
    };
  }
  const readyHosts = supportingHosts.filter(
    (host) =>
      state.hostStatuses[host.id]?.status === "ready" ||
      (host.kind === "local" && state.hostStatus === "ready"),
  );
  if (readyHosts.length > 0 && !state.devices.some((device) => device.platform === platform)) {
    return {
      ready: false,
      message:
        platform === "ios"
          ? t("shellDevice.deviceXcodeNoSimulator")
          : t("shellDevice.deviceAndroidNoDevice"),
    };
  }
  const remoteHost = supportingHosts.every((host) => host.kind !== "local")
    ? supportingHosts[0]
    : undefined;
  return {
    ready: true,
    message: remoteHost
      ? platform === "ios"
        ? t("shellDevice.deviceIosReadyOnHost", { host: remoteHost.label })
        : t("shellDevice.deviceAndroidReadyOnHost", { host: remoteHost.label })
      : platform === "ios"
        ? t("shellDevice.deviceIosReady")
        : t("shellDevice.deviceAndroidReady"),
  };
}

export function DeviceSetup(props: {
  readonly environmentId: EnvironmentId;
  readonly state: DeviceServiceState;
  readonly onComplete?: () => void;
}) {
  const t = useT();
  const canConfigure = useEnvironmentScope(props.environmentId, AuthSettingsWriteScope);
  const configure = useAtomCommand(deviceEnvironment.configure);
  const list = useAtomCommand(deviceEnvironment.list, { reportFailure: false });
  const [pending, setPending] = useState<"hub" | "check" | "agent" | "complete" | null>(null);
  const [step, setStep] = useState(0);
  const enabled = props.state.hostStatus !== "disabled";
  const { ready, busy } = deviceHubReadiness(props.state);
  const localPlatformsUnavailable = props.state.hosts.some(
    (host) => host.kind === "local" && !host.platforms.some((platform) => platform.available),
  );

  // Remote hosts report platforms only after a probe, like the Device panel's refresh on open.
  useEffect(() => {
    if (enabled) void list({ environmentId: props.environmentId, input: {} });
  }, [enabled, list, props.environmentId]);

  const update = async (
    kind: NonNullable<typeof pending>,
    input: { enabled?: boolean; agentAccessEnabled?: boolean; onboardingCompleted?: boolean },
  ) => {
    if (!readEnvironmentScope(props.environmentId, AuthSettingsWriteScope)) return;
    setPending(kind);
    const result = await configure({ environmentId: props.environmentId, input });
    setPending(null);
    if (kind === "complete" && result._tag === "Success") props.onComplete?.();
  };

  return (
    <>
      <WizardHeader
        title={t("shellDevice.deviceSetupTitle")}
        description={t("shellDevice.deviceSetupDescription")}
      >
        <WizardSteps
          steps={[
            t("shellDevice.deviceHubStep"),
            t("shellDevice.deviceSimulatorsStep"),
            t("shellDevice.deviceAgentAccessStep"),
          ]}
          currentStep={step}
          onStepChange={setStep}
          isStepDisabled={(requested) => busy || pending !== null || requested > step}
        />
      </WizardHeader>

      <WizardPanel>
        <DeviceHostUpdates state={props.state} environmentId={props.environmentId} />
        {step === 0 ? (
          <section className="space-y-3 text-sm">
            <h3 className="font-medium">{t("shellDevice.deviceEnableHub")}</h3>
            <div className="flex items-start justify-between gap-4">
              <p className="text-muted-foreground">{deviceHubDescription}</p>
              <Switch
                checked={enabled}
                disabled={!canConfigure || busy || pending !== null}
                aria-label={t("shellDevice.deviceEnableHubAria")}
                onCheckedChange={(checked) =>
                  void update("hub", {
                    enabled: Boolean(checked),
                    ...(checked ? {} : { agentAccessEnabled: false }),
                  })
                }
              />
            </div>
            <DeviceHubSetupStatus
              state={props.state}
              pending={pending === "hub" || (busy && pending !== "agent")}
            />
          </section>
        ) : null}

        {step === 1 || (step === 0 && enabled && localPlatformsUnavailable) ? (
          <section className={cn("space-y-3 text-sm", step === 0 && "mt-4")}>
            <h3 className="font-medium">{t("shellDevice.deviceCheckSimulatorSupport")}</h3>
            <DevicePlatformSetup
              state={props.state}
              checking={pending === "check"}
              disabled={!enabled || busy || pending !== null}
              onCheck={() => {
                setPending("check");
                void list({ environmentId: props.environmentId, input: {} }).finally(() =>
                  setPending(null),
                );
              }}
            />
          </section>
        ) : null}

        {step === 2 ? (
          <section className="space-y-3 text-sm">
            <h3 className="font-medium">{t("shellDevice.deviceAllowAgentControl")}</h3>
            <div className="flex items-start justify-between gap-4">
              <p className="text-muted-foreground">{agentDeviceDescription}</p>
              <Switch
                checked={props.state.agentAccessEnabled}
                disabled={!canConfigure || !enabled || busy || pending !== null}
                aria-label={t("shellDevice.deviceAllowAgentsAria")}
                onCheckedChange={(checked) =>
                  void update("agent", { agentAccessEnabled: Boolean(checked) })
                }
              />
            </div>
            <AgentDeviceSetupStatus state={props.state} pending={pending === "agent"} />
            <p className="text-xs text-muted-foreground">{t("shellDevice.deviceLeaveOffHint")}</p>
          </section>
        ) : null}
        {props.state.hostStatus === "failed" && props.state.hostStatusDetail ? (
          <p role="alert" className="mt-3 text-xs text-destructive">
            {props.state.hostStatusDetail}
          </p>
        ) : null}
      </WizardPanel>

      <WizardFooter>
        {step === 0 ? (
          <DialogClose render={<Button variant="outline" />}>{t("common.cancel")}</DialogClose>
        ) : (
          <Button
            variant="outline"
            disabled={busy || pending !== null}
            onClick={() => setStep(step - 1)}
          >
            {t("shellDevice.deviceBack")}
          </Button>
        )}
        {step < 2 ? (
          <Button disabled={!ready || pending !== null} onClick={() => setStep(step + 1)}>
            {t("common.continue")}
          </Button>
        ) : (
          <Button
            disabled={!canConfigure || !ready || pending !== null}
            onClick={() => void update("complete", { onboardingCompleted: true })}
          >
            {pending === "complete" ? t("shellDevice.deviceSaving") : t("common.done")}
          </Button>
        )}
      </WizardFooter>
    </>
  );
}

export function DeviceHubSetupStatus({
  state,
  pending,
  compact = false,
}: {
  readonly state: DeviceServiceState;
  readonly pending: boolean;
  readonly compact?: boolean;
}) {
  const t = useT();
  if (!pending && !deviceHubReadiness(state).ready) return null;
  return (
    <p role="status" className="flex items-center gap-2 text-xs text-muted-foreground">
      {pending ? <Spinner size="xs" /> : <Check className="size-3 text-success" />}
      {pending
        ? state.hostStatus === "installing"
          ? compact
            ? t("shellDevice.deviceInstallingCompact")
            : t("shellDevice.deviceInstallingHub")
          : state.hostStatus === "starting"
            ? compact
              ? t("shellDevice.deviceStartingCompact")
              : t("shellDevice.deviceStartingHub")
            : compact
              ? t("shellDevice.deviceUpdatingCompact")
              : t("shellDevice.deviceUpdatingHub")
        : t("shellDevice.deviceHubReady")}
    </p>
  );
}

function DevicePlatformSetup(props: {
  readonly state: DeviceServiceState;
  readonly checking: boolean;
  readonly disabled: boolean;
  readonly onCheck: () => void;
}) {
  const t = useT();
  return (
    <div className="space-y-3">
      <PlatformStatus platform="iOS" status={platformSetupStatus(props.state, "ios", t)} />
      <PlatformStatus platform="Android" status={platformSetupStatus(props.state, "android", t)} />
      <p className="text-xs text-muted-foreground">{t("shellDevice.devicePlatformChoiceHint")}</p>
      <Button size="compact" variant="outline" disabled={props.disabled} onClick={props.onCheck}>
        {props.checking ? <Spinner size="xs" /> : null}
        {props.checking ? t("shellDevice.deviceChecking") : t("shellDevice.deviceCheckAgain")}
      </Button>
    </div>
  );
}

export function AgentDeviceSetupStatus(props: {
  readonly state: DeviceServiceState;
  readonly pending: boolean;
  readonly compact?: boolean;
}) {
  const t = useT();
  if (props.pending) {
    const label =
      props.state.hostStatus === "installing"
        ? props.compact
          ? t("shellDevice.deviceInstallingCompact")
          : t("shellDevice.deviceInstallingAgentTools")
        : props.state.hostStatus === "starting"
          ? props.compact
            ? t("shellDevice.deviceStartingCompact")
            : t("shellDevice.deviceStartingAgentTools")
          : props.compact
            ? t("shellDevice.deviceUpdatingCompact")
            : t("shellDevice.deviceUpdatingAgentAccess");
    return (
      <p role="status" className="flex items-center gap-2 text-xs text-muted-foreground">
        <Spinner size="xs" />
        {label}
      </p>
    );
  }
  if (
    props.state.agentAccessEnabled &&
    deviceHubReadiness(props.state).ready &&
    props.state.hosts.some((host) => host.agentDeviceInstalled)
  ) {
    return (
      <p role="status" className="flex items-center gap-2 text-xs text-muted-foreground">
        <Check className="size-3 text-success" />
        {t("shellDevice.deviceAgentToolsReady")}
      </p>
    );
  }
  return null;
}

export function PlatformStatus(props: {
  readonly platform: string;
  readonly status: { readonly ready: boolean; readonly message: string };
  readonly compact?: boolean;
}) {
  const t = useT();
  return (
    <div
      className={cn("flex gap-2", !props.compact && "rounded-md border border-border/60 px-3 py-2")}
    >
      <MorphIcon
        className={cn(
          "mt-0.5 size-4 shrink-0",
          props.status.ready ? "text-success" : "text-muted-foreground",
        )}
        icon={props.status.ready ? CheckGlyph : CircleAlert}
      />
      <div className={cn(props.compact && props.status.ready && "flex items-center gap-2")}>
        <p className="font-medium">{props.platform}</p>
        <p className="text-xs text-muted-foreground">
          {props.compact && props.status.ready
            ? t("shellDevice.deviceReady")
            : props.status.message}
        </p>
      </div>
    </div>
  );
}
