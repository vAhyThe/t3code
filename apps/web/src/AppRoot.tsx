import { RouterProvider } from "@tanstack/react-router";

import { ElectronBrowserHost } from "./browser/ElectronBrowserHost";
import { QuitHoldOverlay } from "./components/QuitHoldOverlay";
import { I18nSettingsSync } from "./i18n/I18nSettingsSync";
import { AppAtomRegistryProvider } from "./rpc/atomRegistry";

import type { AppRouter } from "./router";

// Keep webviews outside the router but inside its atom registry so route changes preserve them.
export function AppRoot({ router }: { readonly router: AppRouter }) {
  return (
    <AppAtomRegistryProvider>
      <I18nSettingsSync>
        <RouterProvider router={router} />
        <ElectronBrowserHost />
        <QuitHoldOverlay />
      </I18nSettingsSync>
    </AppAtomRegistryProvider>
  );
}
