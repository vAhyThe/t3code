import { RouterProvider } from "@tanstack/react-router";

import { BrowserProfileReporter } from "./browser/BrowserProfileReporter";
import { ElectronBrowserHost } from "./browser/ElectronBrowserHost";
import { QuitHoldOverlay } from "./components/QuitHoldOverlay";
import { I18nSettingsSync } from "./i18n/I18nSettingsSync";
import { AppAtomRegistryProvider } from "./rpc/atomRegistry";
import type { AppRouter } from "./router";

/**
 * The Electron browser host intentionally sits outside the router so its
 * webviews survive route transitions, but it must share the same atom registry
 * as routed UI.
 */
export function AppRoot({ router }: { readonly router: AppRouter }) {
  return (
    <I18nSettingsSync>
      <AppAtomRegistryProvider>
        <RouterProvider router={router} />
        <ElectronBrowserHost />
        <BrowserProfileReporter />
        <QuitHoldOverlay />
      </AppAtomRegistryProvider>
    </I18nSettingsSync>
  );
}
