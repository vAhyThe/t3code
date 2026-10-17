import { usesChatGptSharing } from "@t3tools/shared/usageLimits";
import type { ServerProvider } from "@t3tools/contracts";
import { useT } from "~/i18n/I18nProvider";
import { OpenAI } from "../Icons";
import { ChatGptUsageButton } from "../settings/ChatGptUsageButton";

export function ChatGptSharingControl({ provider }: { provider: ServerProvider | null }) {
  const t = useT();
  if (!usesChatGptSharing(provider)) return null;
  return (
    <div className="flex items-center justify-between gap-4 border-t px-3 py-2">
      <span className="flex items-center gap-2 text-xs text-muted-foreground">
        <OpenAI className="size-3.5" aria-hidden="true" />
        {t("chat.usingChatGptPlan")}
      </span>
      <ChatGptUsageButton size="xs" />
    </div>
  );
}
