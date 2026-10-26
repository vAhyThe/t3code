import { currentTranslator } from "~/i18n/I18nProvider";
import { useAuth } from "@clerk/react";
import { DEFAULT_UNIFIED_SETTINGS } from "@t3tools/contracts/settings";
import { Link } from "@tanstack/react-router";

import { hasCloudPublicConfig } from "~/cloud/publicConfig";
import { useT3ConnectAuthPrompt } from "../clerk/useT3ConnectAuthPrompt";
import { Button } from "../ui/button";
import { Switch } from "../ui/switch";
import { ScopedSwitch } from "./ScopedSwitch";
import {
  SettingResetButton,
  SettingsPageContainer,
  SettingsRow,
  SettingsSection,
} from "./settingsLayout";
import { searchableSetting } from "./settingsSearch";
import { useScopedSettings, useUpdateScopedSettings } from "./useScopedSettings";

/** Features that are still settling in. Some are on by default; each can be turned off here. */
export function BetaSettingsPanel() {
  const settings = useScopedSettings();
  const updateSettings = useUpdateScopedSettings();
  return (
    <SettingsPageContainer>
      <SettingsSection id="beta" title="Beta">
        <SettingsRow
          {...searchableSetting("new-design")}
          description={currentTranslator()("updates.aTrueBlackDarkModeDimmerReadThreads")}
          resetAction={
            settings.redesignEnabled !== DEFAULT_UNIFIED_SETTINGS.redesignEnabled ? (
              <SettingResetButton
                label="new design"
                onClick={() =>
                  updateSettings({ redesignEnabled: DEFAULT_UNIFIED_SETTINGS.redesignEnabled })
                }
              />
            ) : null
          }
          control={
            <Switch
              checked={settings.redesignEnabled}
              onCheckedChange={(checked) => updateSettings({ redesignEnabled: Boolean(checked) })}
              aria-label={currentTranslator()("updates.newDesign")}
            />
          }
        />
        <SettingsRow
          {...searchableSetting("working-shelf")}
          description={currentTranslator()("settingsC.foldWorking")}
          resetAction={
            settings.sidebarWorkingShelfEnabled !==
            DEFAULT_UNIFIED_SETTINGS.sidebarWorkingShelfEnabled ? (
              <SettingResetButton
                label={currentTranslator()("settingsC.labelWorkingSection")}
                onClick={() =>
                  updateSettings({
                    sidebarWorkingShelfEnabled: DEFAULT_UNIFIED_SETTINGS.sidebarWorkingShelfEnabled,
                  })
                }
              />
            ) : null
          }
          control={
            <Switch
              checked={settings.sidebarWorkingShelfEnabled}
              onCheckedChange={(checked) =>
                updateSettings({ sidebarWorkingShelfEnabled: Boolean(checked) })
              }
              aria-label={currentTranslator()("settingsC.restoreWorkingSection")}
            />
          }
        />
        {/* Clerk is only mounted when this build has T3 Connect. */}
        {hasCloudPublicConfig() ? <GuestLinksRowWithSignIn /> : <GuestLinksRow />}
      </SettingsSection>
    </SettingsPageContainer>
  );
}

/** Signed out of T3 Connect, the row offers to sign in instead of its switch. */
function GuestLinksRowWithSignIn() {
  const { isSignedIn } = useAuth();
  const { openAuthPrompt } = useT3ConnectAuthPrompt();
  // `isSignedIn` is undefined until Clerk loads.
  if (isSignedIn !== false) return <GuestLinksRow />;
  return (
    <SettingsRow
      {...searchableSetting("guest-links")}
      description={currentTranslator()("updates.shareAThreadWithAGuestWhoWatches")}
      control={
        <Button size="sm" variant="outline" onClick={openAuthPrompt}>
          {currentTranslator()("settingsC.signIn")}
        </Button>
      }
    />
  );
}

function GuestLinksRow() {
  const settings = useScopedSettings();
  const updateSettings = useUpdateScopedSettings();
  return (
    <SettingsRow
      serverScoped
      {...searchableSetting("guest-links")}
      settingKeys={["guestSharingEnabled"]}
      description={
        <>
          {currentTranslator()("updates.shareAThreadWithAGuestWhoWatches2")}{" "}
          <Link to="/settings/connections" className="underline underline-offset-2">
            {currentTranslator()("updates.connections")}
          </Link>
          . While it is off, every guest link stops working.
        </>
      }
      control={
        <ScopedSwitch
          settingKeys={["guestSharingEnabled"]}
          checked={settings.guestSharingEnabled}
          onCheckedChange={(checked) => updateSettings({ guestSharingEnabled: Boolean(checked) })}
          aria-label={currentTranslator()("updates.guestLinks")}
        />
      }
    />
  );
}
