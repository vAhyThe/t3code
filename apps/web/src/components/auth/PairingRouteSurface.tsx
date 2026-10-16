import { Alert, AlertDescription } from "../ui/alert";
import type { AuthSessionState } from "@t3tools/contracts";
import type { Translate } from "@t3tools/client-runtime/i18n";
import { squashAtomCommandFailure } from "@t3tools/client-runtime/state/runtime";
import React, { startTransition, useEffect, useRef, useState, useCallback } from "react";

import { APP_DISPLAY_NAME } from "../../branding";
import { connectPairing } from "../../connection/onboarding";
import {
  peekPairingTokenFromUrl,
  stripPairingTokenFromUrl,
  submitServerAuthCredential,
} from "../../environments/primary";
import { readHostedPairingRequest } from "../../hostedPairing";
import { currentTranslator, useT } from "../../i18n/I18nProvider";
import { Trans } from "../../i18n/Trans";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { StandalonePage, StandalonePageHeader } from "../ui/standalone-page";
import { useAtomCommand } from "../../state/use-atom-command";

export function PairingPendingSurface() {
  const t = useT();
  return (
    <StandalonePage tone="pairing">
      <StandalonePageHeader
        eyebrow={APP_DISPLAY_NAME}
        title={t("shellDevice.pairingWithEnvironment")}
        description={t("shellDevice.pairingValidating")}
      />
    </StandalonePage>
  );
}

export function PairingRouteSurface({
  auth,
  initialErrorMessage,
  onAuthenticated,
}: {
  auth: AuthSessionState["auth"];
  initialErrorMessage?: string;
  onAuthenticated: () => void;
}) {
  const t = useT();
  const autoPairTokenRef = useRef<string | null>(peekPairingTokenFromUrl());
  const [credential, setCredential] = useState(() => autoPairTokenRef.current ?? "");
  const [errorMessage, setErrorMessage] = useState(initialErrorMessage ?? "");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const autoSubmitAttemptedRef = useRef(false);

  const submitCredential = useCallback(
    async (nextCredential: string) => {
      setIsSubmitting(true);
      setErrorMessage("");

      const submitError = await submitServerAuthCredential(nextCredential).then(
        () => null,
        (error) => errorMessageFromUnknown(error),
      );

      setIsSubmitting(false);

      if (submitError) {
        setErrorMessage(submitError);
        return;
      }

      startTransition(() => {
        onAuthenticated();
      });
    },
    [onAuthenticated],
  );

  const handleSubmit = useCallback(
    async (event?: React.SubmitEvent<HTMLFormElement>) => {
      event?.preventDefault();
      await submitCredential(credential);
    },
    [submitCredential, credential],
  );

  useEffect(() => {
    const token = autoPairTokenRef.current;
    if (!token || autoSubmitAttemptedRef.current) {
      return;
    }

    autoSubmitAttemptedRef.current = true;
    stripPairingTokenFromUrl();
    void submitCredential(token);
  }, [submitCredential]);

  return (
    <StandalonePage tone="pairing">
      <StandalonePageHeader
        eyebrow={APP_DISPLAY_NAME}
        title={t("shellDevice.pairEnvironment")}
        description={describeAuthGate(auth.bootstrapMethods, t)}
      />

      <form className="mt-6 space-y-4" onSubmit={(event) => void handleSubmit(event)}>
        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="pairing-token">
            {t("shellDevice.pairingTokenLabel")}
          </label>
          <Input
            id="pairing-token"
            autoCapitalize="none"
            autoComplete="off"
            autoCorrect="off"
            disabled={isSubmitting}
            nativeInput
            onChange={(event) => setCredential(event.currentTarget.value)}
            placeholder={t("shellDevice.pairingTokenPlaceholder")}
            spellCheck={false}
            value={credential}
          />
        </div>

        {errorMessage ? (
          <Alert variant="error">
            <AlertDescription>{errorMessage}</AlertDescription>
          </Alert>
        ) : null}

        <div className="flex flex-wrap gap-2">
          <Button disabled={isSubmitting} size="sm" type="submit">
            {isSubmitting ? t("shellDevice.pairingSubmitting") : t("common.continue")}
          </Button>
          <Button
            disabled={isSubmitting}
            onClick={() => window.location.reload()}
            size="sm"
            variant="outline"
          >
            {t("shellDevice.pairingReloadApp")}
          </Button>
        </div>
      </form>

      <div className="mt-6 rounded-lg border border-border/70 bg-background/55 px-3 py-3 text-xs leading-relaxed text-muted-foreground">
        {describeSupportedMethods(auth.bootstrapMethods, t)}
      </div>
    </StandalonePage>
  );
}

export function HostedPairingRouteSurface() {
  const t = useT();
  const connectPairingEnvironment = useAtomCommand(connectPairing, {
    reportFailure: false,
  });
  const hostedPairingRequestRef = useRef(readHostedPairingRequest());
  const [status, setStatus] = useState<"pairing" | "paired" | "error">(() =>
    hostedPairingRequestRef.current ? "pairing" : "error",
  );
  const [message, setMessage] = useState(() =>
    hostedPairingRequestRef.current
      ? t("shellDevice.pairingBackendConnecting")
      : t("shellDevice.pairingMissingHostOrToken"),
  );
  const [canRetry, setCanRetry] = useState(false);
  const submitAttemptedRef = useRef(false);
  const tokenSubmittedRef = useRef(false);

  const submitHostedPairingRequest = useCallback(async () => {
    const request = hostedPairingRequestRef.current;

    if (!request) {
      setStatus("error");
      setMessage(currentTranslator()("shellDevice.pairingMissingHostOrToken"));
      setCanRetry(false);
      return;
    }

    if (tokenSubmittedRef.current) {
      setStatus("error");
      setMessage(currentTranslator()("shellDevice.pairingTokenAlreadySubmitted"));
      setCanRetry(false);
      return;
    }

    setStatus("pairing");
    setMessage(currentTranslator()("shellDevice.pairingBackendConnecting"));
    setCanRetry(false);
    tokenSubmittedRef.current = true;

    const result = await connectPairingEnvironment({
      host: request.host,
      pairingCode: request.token,
    });
    if (result._tag === "Success") {
      setStatus("paired");
      setMessage(
        currentTranslator()("shellDevice.pairingEnvironmentSaved", {
          name: request.label || currentTranslator()("shellDevice.pairingEnvironmentFallbackName"),
        }),
      );
      return;
    }

    tokenSubmittedRef.current = false;
    setStatus("error");
    setCanRetry(true);
    setMessage(
      currentTranslator()("shellDevice.pairingRetryHint", {
        error: errorMessageFromUnknown(squashAtomCommandFailure(result)),
      }),
    );
  }, [connectPairingEnvironment]);

  useEffect(() => {
    if (submitAttemptedRef.current) {
      return;
    }
    submitAttemptedRef.current = true;

    stripPairingTokenFromUrl();
    void submitHostedPairingRequest();
  }, [submitHostedPairingRequest]);

  const request = hostedPairingRequestRef.current;

  return (
    <StandalonePage tone="pairing">
      <StandalonePageHeader
        eyebrow={APP_DISPLAY_NAME}
        title={
          status === "paired"
            ? t("shellDevice.pairingBackendPaired")
            : status === "error"
              ? t("shellDevice.pairingFailed")
              : t("shellDevice.pairingBackend")
        }
        description={message}
      />

      {request ? (
        <div className="mt-5 rounded-lg border border-border/70 bg-background/55 px-3 py-3 text-xs leading-relaxed text-muted-foreground">
          <Trans
            k="shellDevice.pairingHostLine"
            params={{ host: request.host }}
            components={{
              host: (children) => <span className="font-mono text-foreground/80">{children}</span>,
            }}
          />
        </div>
      ) : null}

      {status === "error" ? (
        <Alert variant="error" className="mt-5">
          <AlertDescription>{t("shellDevice.pairingHostedVerify")}</AlertDescription>
        </Alert>
      ) : null}

      <div className="mt-6 flex flex-wrap gap-2">
        {status === "pairing" ? (
          <Button disabled size="sm">
            {t("shellDevice.pairingSubmitting")}
          </Button>
        ) : canRetry ? (
          <Button size="sm" onClick={() => void submitHostedPairingRequest()}>
            {t("common.tryAgain")}
          </Button>
        ) : null}
        {status === "paired" ? (
          <Button size="sm" variant="outline" onClick={() => (window.location.href = "/")}>
            {t("shellDevice.pairingOpenApp")}
          </Button>
        ) : null}
      </div>
    </StandalonePage>
  );
}

function errorMessageFromUnknown(error: unknown): string {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }

  if (typeof error === "string" && error.trim().length > 0) {
    return error;
  }

  return currentTranslator()("shellDevice.pairingAuthFailed");
}

function describeAuthGate(bootstrapMethods: ReadonlyArray<string>, t: Translate): string {
  if (bootstrapMethods.includes("desktop-bootstrap")) {
    return t("shellDevice.pairingGateTrusted");
  }

  return t("shellDevice.pairingGateToken");
}

function describeSupportedMethods(bootstrapMethods: ReadonlyArray<string>, t: Translate): string {
  if (
    bootstrapMethods.includes("desktop-bootstrap") &&
    bootstrapMethods.includes("one-time-token")
  ) {
    return t("shellDevice.pairingMethodsBoth");
  }

  if (bootstrapMethods.includes("desktop-bootstrap")) {
    return t("shellDevice.pairingMethodsDesktop");
  }

  return t("shellDevice.pairingMethodsToken");
}
