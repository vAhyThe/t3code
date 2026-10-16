import { chat } from "./chat.ts";
import { common } from "./common.ts";
import { desktop } from "./desktop.ts";
import { pullRequest } from "./pullRequest.ts";
import { settingsA } from "./settingsA.ts";
import { settingsB } from "./settingsB.ts";
import { settingsC } from "./settingsC.ts";
import { settingsD } from "./settingsD.ts";
import { shellDevice } from "./shellDevice.ts";
import { shellNav } from "./shellNav.ts";
import { shellRest } from "./shellRest.ts";

/**
 * The English source catalog. Values are the original upstream text verbatim,
 * so a string can be traced back to the component it came from.
 */
export const enMessages = {
  common,
  settingsA,
  settingsB,
  settingsC,
  settingsD,
  chat,
  pullRequest,
  shellNav,
  shellDevice,
  shellRest,
  desktop,
} as const;

export type EnMessages = typeof enMessages;
export type MessageNamespace = keyof EnMessages;

export type MessageKey = {
  [N in MessageNamespace]: `${N}.${Extract<keyof EnMessages[N], string>}`;
}[MessageNamespace];

/** Czech has four plural categories, so every plural message needs all of them. */
type CzechMessage<M> = M extends string
  ? string
  : { readonly one: string; readonly few: string; readonly many: string; readonly other: string };

/** A Czech namespace must translate every key of its English counterpart. */
export type CzechNamespace<N extends MessageNamespace> = {
  readonly [K in keyof EnMessages[N]]: CzechMessage<EnMessages[N][K]>;
};
