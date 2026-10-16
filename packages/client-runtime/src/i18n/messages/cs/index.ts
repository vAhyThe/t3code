/*
 * Czech catalog. Formal imperative, as in macOS system apps ("Zadejte",
 * "Vyberte"). Every wave keeps to this glossary:
 *
 *   thread               vlákno
 *   turn                 kolo (one user and agent cycle)
 *   project              projekt
 *   environment          prostředí
 *   agent / provider     agent / poskytovatel
 *   checkpoint           checkpoint (not translated)
 *   worktree, commit,
 *   diff, prompt         unchanged (developer jargon)
 *   branch               větev
 *   pull request         pull request (PR)
 *   composer             pole zprávy
 *   keybinding           klávesová zkratka
 *   snooze / archive     odložit / archivovat
 *   pairing              párování
 *   usage limit          limit využití
 *   Settings             Nastavení
 *
 * Never translate text sent to agents, providers or git, command and
 * keybinding IDs, CLI commands, paths, brand and model names, or server errors.
 */
import { chat } from "./chat.ts";
import { common } from "./common.ts";
import { desktop } from "./desktop.ts";
import { pullRequest } from "./pullRequest.ts";
import { settingsA } from "./settingsA.ts";
import { settingsB } from "./settingsB.ts";
import { shell } from "./shell.ts";

export const csMessages = {
  common,
  settingsA,
  settingsB,
  chat,
  pullRequest,
  shell,
  desktop,
};
