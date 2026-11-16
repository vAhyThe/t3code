import { currentTranslator } from "~/i18n/I18nProvider";

export type BrowserMicrophone = Pick<MediaDeviceInfo, "deviceId" | "label">;

export async function listBrowserMicrophones(): Promise<BrowserMicrophone[]> {
  const devices = await navigator.mediaDevices.enumerateDevices();
  return devices
    .filter((device) => device.kind === "audioinput")
    .map(({ deviceId, label }, index) => ({
      deviceId,
      label: label || currentTranslator()("voice.microphoneN", { number: index + 1 }),
    }));
}
