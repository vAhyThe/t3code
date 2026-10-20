import { lazy, Suspense, useSyncExternalStore } from "react";

import { useTheme } from "../../hooks/useTheme";
import {
  getThemeDefinition,
  subscribeToCustomThemes,
  type ThemeAppearance,
  type ThemeDefinition,
} from "../../themePalette";
import { stackedThreadToast, toastManager } from "../ui/toast";
import { currentTranslator } from "~/i18n/I18nProvider";
import { useThemeEditorStore } from "./themeEditorStore";

const ThemeEditorPanel = lazy(() =>
  import("./ThemeEditorPanel").then((module) => ({ default: module.ThemeEditorPanel })),
);

function useThemeDefinition(id: string | null | undefined) {
  return useSyncExternalStore(
    subscribeToCustomThemes,
    () => (id ? (getThemeDefinition(id) ?? null) : null),
    () => null,
  );
}

export function ThemeEditorHost() {
  const session = useThemeEditorStore((store) => store.session);
  const closeThemeEditor = useThemeEditorStore((store) => store.closeThemeEditor);
  const { theme, setTheme, themeHalves, refreshTheme } = useTheme();
  const editingTheme = useThemeDefinition(session?.editingThemeId);
  const seedTheme = useThemeDefinition(session?.seedThemeId);

  const handleSaved = (
    savedTheme: ThemeDefinition,
    { created, mergedAppearance }: { created: boolean; mergedAppearance?: ThemeAppearance },
  ) => {
    const t = currentTranslator();
    if (mergedAppearance) {
      if (!setTheme(savedTheme.id)) {
        toastManager.add(
          stackedThreadToast({
            type: "error",
            title: t("settingsD.couldNotSaveYourTheme"),
            description: t("settingsD.browserStorageUnavailable"),
          }),
        );
        return false;
      }
      toastManager.add(
        stackedThreadToast({
          type: "success",
          title: t("settingsD.themeUpdated", { name: savedTheme.label }),
          description:
            mergedAppearance === "light"
              ? t("settingsD.itsLightPaletteAdded")
              : t("settingsD.itsDarkPaletteAdded"),
        }),
      );
      return true;
    }
    if (!created) {
      // The edited theme may be showing through the base preference or either
      // half of the mix; the preference itself is untouched (a setTheme here
      // would clear the mix), the palette just needs re-applying.
      const wasActive =
        getThemeDefinition(theme)?.id === savedTheme.id ||
        themeHalves?.light === savedTheme.id ||
        themeHalves?.dark === savedTheme.id;
      if (wasActive) refreshTheme();
      toastManager.add(
        stackedThreadToast({
          type: "success",
          title: t("settingsD.themeSaved", { name: savedTheme.label }),
          description: wasActive ? t("settingsD.changesNowActive") : t("settingsD.changesSaved"),
        }),
      );
      return true;
    }

    if (!setTheme(savedTheme.id)) {
      toastManager.add(
        stackedThreadToast({
          type: "error",
          title: t("settingsD.couldNotSaveYourTheme"),
          description: t("settingsD.browserStorageUnavailable"),
        }),
      );
      return false;
    }
    toastManager.add(
      stackedThreadToast({
        type: "success",
        title: t("settingsD.themeCreated", { name: savedTheme.label }),
        description: t("settingsD.nowActive"),
      }),
    );
    return true;
  };

  if (!session) return null;

  return (
    <Suspense fallback={null}>
      <ThemeEditorPanel
        editingTheme={editingTheme}
        initialAppearance={session.initialAppearance}
        key={session.id}
        onOpenChange={(open) => {
          if (!open) closeThemeEditor();
        }}
        onSaved={handleSaved}
        open
        restoreTheme={refreshTheme}
        seedName={session.seedName ?? undefined}
        seedTheme={seedTheme}
      />
    </Suspense>
  );
}
