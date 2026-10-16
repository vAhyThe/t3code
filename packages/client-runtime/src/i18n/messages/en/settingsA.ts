import type { CatalogNamespace } from "../types.ts";

export const settingsA = {
  language: "Language",
  languageDescription: "The language T3 Code is shown in. System follows your operating system.",
  languageResetLabel: "language",
  languageSystem: "System",
} as const satisfies CatalogNamespace;
