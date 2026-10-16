import type { DevicePlatform } from "@t3tools/contracts";
import {
  Camera,
  ChevronLeft,
  Home,
  Keyboard,
  Box,
  Maximize,
  MoreHorizontal,
  PictureInPicture2,
  Power,
  RotateCcw,
  SlidersHorizontal,
  Smartphone,
  Square,
  Type,
  X,
} from "lucide-react";
import { Moon, Sun } from "lucide";
import type { ReactNode } from "react";
import { Button } from "~/components/ui/button";
import { MorphIcon } from "~/components/MorphIcon";
import {
  Menu,
  MenuItem,
  MenuPopup,
  MenuSeparator,
  MenuTrigger,
  MenuRadioGroup,
  MenuRadioItem,
  MenuRadioItemIndicator,
} from "~/components/ui/menu";
import { Tooltip, TooltipPopup, TooltipTrigger } from "~/components/ui/tooltip";
import { useT } from "~/i18n/I18nProvider";
import type { DeviceStreamHandle, DeviceViewControls } from "./DeviceStreamView";
import type { DeviceControls } from "./useDeviceControls";

/** Stable floating controls for both presentations, regardless of panel width. */
export function DeviceControlsRail(props: {
  platform: DevicePlatform;
  handle: DeviceStreamHandle | null;
  view: DeviceViewControls;
  controls: DeviceControls;
  screenshotPending: boolean;
  onScreenshot: () => void;
  toolsOpen: boolean;
  onTools: () => void;
  onFloat: () => void;
  onClose: () => void;
  onPowerOff: () => void;
}) {
  const t = useT();
  const { view, handle, controls } = props;
  const popupSide = "left";
  const settings = controls.detail?.settings;
  const inputDisabled = !handle?.inputConnected;
  const nextAppearance = settings?.appearance === "dark" ? "light" : "dark";
  return (
    <aside
      aria-label={t("shellDevice.deviceControlsAria")}
      data-layout="rail"
      className="pointer-events-none absolute inset-y-0 right-0 z-10 flex w-14 flex-col items-center gap-2 overflow-y-auto [justify-content:safe_center] py-3 pr-2 [scrollbar-width:none]"
    >
      <div className="pointer-events-auto flex shrink-0 flex-col items-center gap-1 overflow-y-auto rounded-full border border-border/50 bg-background/80 p-2 shadow-sm [scrollbar-width:none]">
        <RailButton
          tooltipSide={popupSide}
          label={t("shellDevice.deviceHome")}
          disabled={inputDisabled}
          onClick={() => handle?.pressButton("home")}
        >
          <Home />
        </RailButton>
        {props.platform === "android" ? (
          <>
            <RailButton
              tooltipSide={popupSide}
              label={t("shellDevice.deviceBack")}
              disabled={inputDisabled}
              onClick={() => handle?.pressButton("back")}
            >
              <ChevronLeft />
            </RailButton>
            <RailButton
              tooltipSide={popupSide}
              label={t("shellDevice.deviceRecents")}
              disabled={inputDisabled}
              onClick={() => handle?.pressButton("recents")}
            >
              <Square />
            </RailButton>
            <Menu>
              <MenuTrigger
                render={
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    aria-label={t("shellDevice.deviceRotateDevice")}
                    disabled={controls.disabled}
                  />
                }
              >
                <RotateCcw />
              </MenuTrigger>
              <MenuPopup side={popupSide}>
                <MenuItem
                  onClick={() => void controls.act({ type: "setOrientation", value: "portrait" })}
                >
                  {t("shellDevice.deviceOrientationPortrait")}
                </MenuItem>
                <MenuItem
                  onClick={() =>
                    void controls.act({ type: "setOrientation", value: "landscape_left" })
                  }
                >
                  {t("shellDevice.deviceLandscape")}
                </MenuItem>
              </MenuPopup>
            </Menu>
          </>
        ) : (
          <RailButton
            tooltipSide={popupSide}
            label={t("shellDevice.deviceRotateDevice")}
            disabled={inputDisabled || !!view.keyboard?.attached}
            onClick={() => handle?.rotate()}
          >
            <RotateCcw />
          </RailButton>
        )}
        <RailDivider />
        <RailButton
          tooltipSide={popupSide}
          label={
            nextAppearance === "dark"
              ? t("shellDevice.deviceSwitchToDarkMode")
              : t("shellDevice.deviceSwitchToLightMode")
          }
          disabled={controls.disabled || !settings?.appearance}
          onClick={() => void controls.act({ type: "setAppearance", value: nextAppearance })}
        >
          <MorphIcon icon={settings?.appearance === "dark" ? Sun : Moon} />
        </RailButton>
        <Menu>
          <MenuTrigger
            render={
              <Button
                size="icon-sm"
                variant="ghost"
                aria-label={t("shellDevice.deviceTextSize")}
                title={t("shellDevice.deviceTextSize")}
                disabled={controls.disabled || !settings?.textSize}
              />
            }
          >
            <Type />
          </MenuTrigger>
          <MenuPopup side={popupSide} className="min-w-40">
            <MenuRadioGroup
              value={settings?.textSize ?? ""}
              onValueChange={(value) => {
                if (
                  value === "small" ||
                  value === "default" ||
                  value === "large" ||
                  value === "extra-large"
                )
                  void controls.act({ type: "setTextSize", value });
              }}
            >
              {(
                [
                  ["small", t("shellDevice.deviceTextSizeSmall")],
                  ["default", t("shellDevice.deviceTextSizeDefault")],
                  ["large", t("shellDevice.deviceTextSizeLarge")],
                  ["extra-large", t("shellDevice.deviceTextSizeExtraLarge")],
                ] as const
              ).map(([value, label]) => (
                <MenuRadioItem key={value} value={value}>
                  <span className="flex items-center gap-2">
                    <span className="flex-1">{label}</span>
                    <MenuRadioItemIndicator />
                  </span>
                </MenuRadioItem>
              ))}
            </MenuRadioGroup>
          </MenuPopup>
        </Menu>
        <RailButton
          tooltipSide={popupSide}
          label={t("shellDevice.deviceToolsTitle")}
          pressed={props.toolsOpen}
          onClick={props.onTools}
        >
          <SlidersHorizontal />
        </RailButton>
        <RailButton
          tooltipSide={popupSide}
          label={
            props.screenshotPending
              ? t("shellDevice.deviceCapturingScreenshot")
              : t("shellDevice.deviceSaveScreenshot")
          }
          disabled={!view.streaming || props.screenshotPending}
          onClick={props.onScreenshot}
        >
          <Camera />
        </RailButton>
        <Menu>
          <MenuTrigger
            render={
              <Button
                size="icon-sm"
                variant="ghost"
                aria-label={t("shellDevice.deviceMoreActions")}
                title={t("shellDevice.deviceMoreActions")}
              />
            }
          >
            <MoreHorizontal />
          </MenuTrigger>
          <MenuPopup side={popupSide} align="end">
            <MenuItem onClick={props.onFloat}>
              <PictureInPicture2 />
              {t("shellDevice.deviceFloatOverChat")}
            </MenuItem>
            <MenuItem onClick={props.onClose}>
              <X />
              {t("shellDevice.deviceClosePanel")}
            </MenuItem>
            <MenuSeparator />
            <MenuItem variant="destructive" onClick={props.onPowerOff}>
              <Power />
              {t("shellDevice.devicePowerOff")}
            </MenuItem>
          </MenuPopup>
        </Menu>
        <RailDivider />
        <RailButton
          tooltipSide={popupSide}
          label={t("shellDevice.device3dView")}
          pressed={view.phone}
          disabled={!view.streaming || !!view.phoneUnavailableReason}
          description={view.phoneUnavailableReason ?? undefined}
          onClick={view.showPhone}
        >
          <Box />
        </RailButton>
        <RailButton
          tooltipSide={popupSide}
          label={t("shellDevice.deviceFlatView")}
          pressed={!view.phone}
          disabled={!view.streaming}
          onClick={view.showFlat}
        >
          <Smartphone />
        </RailButton>
        {view.keyboard ? (
          <RailButton
            tooltipSide={popupSide}
            label={
              view.keyboard.attached
                ? t("shellDevice.deviceDetachKeyboard")
                : t("shellDevice.deviceAttachKeyboard")
            }
            pressed={view.keyboard.attached}
            onClick={view.keyboard.toggle}
          >
            <Keyboard />
          </RailButton>
        ) : null}
        {view.phone ? (
          <RailButton
            tooltipSide={popupSide}
            label={t("shellDevice.deviceRestore3dView")}
            onClick={view.resetView}
          >
            <Maximize />
          </RailButton>
        ) : null}
      </div>
      {view.foldingControls}
    </aside>
  );
}

function RailDivider() {
  return <div aria-hidden className="my-1 h-px w-5 shrink-0 bg-border/70" />;
}

function RailButton(props: {
  tooltipSide: "left" | "bottom";
  label: string;
  description?: string | undefined;
  disabled?: boolean;
  pressed?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  const button = (
    <Button
      size="icon-sm"
      variant={props.pressed ? "secondary" : "ghost"}
      aria-label={props.label}
      aria-pressed={props.pressed}
      disabled={props.disabled}
      onClick={props.onClick}
    >
      {props.children}
    </Button>
  );
  return (
    <Tooltip>
      {props.disabled && props.description ? (
        <TooltipTrigger
          render={
            <span className="inline-flex" tabIndex={0} role="group" aria-label={props.label} />
          }
        >
          {button}
        </TooltipTrigger>
      ) : (
        <TooltipTrigger render={button} />
      )}
      <TooltipPopup side={props.tooltipSide}>{props.description ?? props.label}</TooltipPopup>
    </Tooltip>
  );
}
