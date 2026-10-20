import { useT } from "../../i18n/I18nProvider";

import {
  WorkspaceBreadcrumb,
  WorkspaceBreadcrumbItem,
  WorkspaceBreadcrumbSeparator,
} from "../WorkspaceBreadcrumb";
import { SETTINGS_SECTION_LABELS, type SettingsPath } from "./settingsSearch";

const SETTINGS_BREADCRUMB_KEYS = {
  "/settings/diagnostics": "settingsC.breadcrumbDiagnostics",
  "/settings/open-source-licenses": "settingsC.breadcrumbOpenSourceLicenses",
} as const;

function settingsBreadcrumbLabel(pathname: string, t: ReturnType<typeof useT>): string | null {
  const normalizedPathname = pathname.replace(/\/+$/, "") || "/";
  if (normalizedPathname in SETTINGS_BREADCRUMB_KEYS) {
    return t(SETTINGS_BREADCRUMB_KEYS[normalizedPathname as keyof typeof SETTINGS_BREADCRUMB_KEYS]);
  }
  return SETTINGS_SECTION_LABELS[normalizedPathname as SettingsPath] ?? null;
}

export function SettingsBreadcrumb({ pathname }: { pathname: string }) {
  const t = useT();
  const sectionLabel = settingsBreadcrumbLabel(pathname, t);

  return (
    <WorkspaceBreadcrumb ariaLabel={t("settingsC.breadcrumbAria")}>
      {sectionLabel ? (
        <>
          <WorkspaceBreadcrumbItem>{t("settingsC.breadcrumbSettings")}</WorkspaceBreadcrumbItem>
          <WorkspaceBreadcrumbSeparator />
        </>
      ) : null}
      <WorkspaceBreadcrumbItem current className="truncate">
        {sectionLabel ?? t("settingsC.breadcrumbSettings")}
      </WorkspaceBreadcrumbItem>
    </WorkspaceBreadcrumb>
  );
}
