import type { CatalogNamespace } from "../types.ts";

// Only buttons already shown in at least three zones. A text shared by fewer
// belongs in the namespace of the zone that uses it.
export const common = {
  cancel: "Cancel",
  close: "Close",
  continue: "Continue",
  done: "Done",
  edit: "Edit",
  refresh: "Refresh",
  retry: "Retry",
  tryAgain: "Try again",
} as const satisfies CatalogNamespace;
