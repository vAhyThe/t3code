import type { MessageKey } from "@t3tools/client-runtime/i18n";
import { MICROPHONE_PERMISSION_ERROR } from "@t3tools/client-runtime/voice-input";
import { useNavigate } from "@tanstack/react-router";
import { RotateCcwIcon, SettingsIcon, XIcon } from "lucide-react";

import { useT } from "~/i18n/I18nProvider";
import { Button } from "../ui/button";
import { Tooltip, TooltipPopup, TooltipTrigger } from "../ui/tooltip";
import { VoiceInputPill } from "./VoiceInputPill";

const VOICE_ERROR_LABELS: Record<string, MessageKey> = {
  [MICROPHONE_PERMISSION_ERROR]: "voice.labelMicAccess",
  "Microphone access is required for voice input.": "voice.labelMicAccess",
  "This draft is no longer available.": "voice.labelDraftUnavailable",
  "Another voice recording is already active.": "voice.labelAnotherRecording",
  "Voice transcription is not available.": "voice.labelVoiceUnavailable",
  "Voice transcription is still finishing. Try again shortly.": "voice.labelTranscriptionBusy",
  "Voice transcription is not available for this language.": "voice.labelLanguageUnsupported",
  "Could not prepare voice transcription.": "voice.labelPrepareFailed",
  "Could not start voice recording.": "voice.labelStartFailed",
  "Voice recording was interrupted.": "voice.labelRecordingInterrupted",
  "Could not finish voice recording.": "voice.labelFinishFailed",
  "Could not transcribe this recording.": "voice.labelTranscriptionFailed",
  "Voice transcription on this environment failed.": "voice.labelTranscriptionFailed",
  "The draft changed while voice input was running. The transcript was not added.":
    "voice.labelDraftChanged",
  "No speech was detected.": "voice.labelNoSpeech",
  "Microphone processing failed.": "voice.labelMicProcessingFailed",
  "The microphone disconnected.": "voice.labelMicDisconnected",
};

function voiceErrorLabelKey(error: string | null): MessageKey {
  return (error && VOICE_ERROR_LABELS[error]) || "voice.failed";
}

export function VoiceInputErrorPill(props: {
  error: string | null;
  errorAction: "retry" | "settings" | null;
  disabled?: boolean;
  cancelShortcutLabel?: string | null;
  onRetry(): void;
  onDismiss(): void;
}) {
  const t = useT();
  const navigate = useNavigate();
  const openSettings = props.errorAction === "settings";
  const actionLabel = openSettings
    ? t("voice.openVoiceSettings")
    : props.error === "Could not transcribe this recording." ||
        props.error === "Voice transcription on this environment failed."
      ? t("voice.retryTranscription")
      : t("voice.recordAgain");
  return (
    <VoiceInputPill>
      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              type="button"
              size="icon-sm-pill"
              variant="ghost"
              aria-label={t("voice.dismissError")}
              onPointerDown={(event) => event.preventDefault()}
              onClick={props.onDismiss}
            >
              <XIcon />
            </Button>
          }
        />
        <TooltipPopup side="top">
          {t("voice.dismissError")}
          {props.cancelShortcutLabel ? ` (${props.cancelShortcutLabel})` : ""}
        </TooltipPopup>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger
          render={
            <span
              tabIndex={0}
              role="status"
              aria-label={props.error ?? t("voice.failed")}
              className="min-w-0 flex-1 truncate text-sm text-destructive"
            />
          }
        >
          {t(voiceErrorLabelKey(props.error))}
        </TooltipTrigger>
        <TooltipPopup side="top">{props.error ?? t("voice.failed")}</TooltipPopup>
      </Tooltip>
      {props.errorAction ? (
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                type="button"
                size="icon-sm-pill"
                variant="ghost"
                aria-label={actionLabel}
                disabled={props.disabled}
                onPointerDown={(event) => event.preventDefault()}
                onClick={() => {
                  if (openSettings) {
                    props.onDismiss();
                    void navigate({ to: "/settings/voice" });
                  } else {
                    props.onRetry();
                  }
                }}
              >
                {openSettings ? <SettingsIcon /> : <RotateCcwIcon />}
              </Button>
            }
          />
          <TooltipPopup side="top">{actionLabel}</TooltipPopup>
        </Tooltip>
      ) : null}
    </VoiceInputPill>
  );
}
