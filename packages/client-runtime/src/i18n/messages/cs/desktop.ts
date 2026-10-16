import type { CzechNamespace } from "../en/index.ts";

export const desktop = {
  menuAbout: "O aplikaci {name}",
  menuCheckForUpdates: "Zkontrolovat aktualizace...",
  menuSettings: "Nastavení...",
  menuHide: "Skrýt {name}",
  menuQuit: "Ukončit {name}",
  menuFile: "Soubor",
  menuEdit: "Úpravy",
  menuPasteAsText: "Vložit jako text",
  menuSpeech: "Řeč",
  menuView: "Zobrazení",
  menuReload: "Znovu načíst",
  menuForceReload: "Vynutit opětovné načtení",
  menuToggleDevTools: "Přepnout vývojářské nástroje",
  menuActualSize: "Skutečná velikost",
  menuZoomIn: "Přiblížit",
  menuZoomOut: "Oddálit",
  updateUpToDateTitle: "Máte nejnovější verzi!",
  updateUpToDateMessage: "T3 Code {version} je aktuálně nejnovější dostupná verze.",
  updateCheckFailedTitle: "Kontrola aktualizací selhala",
  updateCheckFailedMessage: "Aktualizace se nepodařilo zkontrolovat.",
  updateUnknownError: "Došlo k neznámé chybě. Zkuste to prosím později.",
  updatesUnavailableTitle: "Aktualizace nejsou dostupné",
  updatesUnavailableMessage: "Automatické aktualizace momentálně nejsou dostupné.",
  contextMenuNoSuggestions: "Žádné návrhy",
  contextMenuCopyLink: "Kopírovat odkaz",
  contextMenuCopyImage: "Kopírovat obrázek",
  previewWindowTitle: "Náhled · {title}",
  previewWindowUntitled: "Náhled prohlížeče",
  browserOpenLinkTitle: "Otevřít tento odkaz {protocol}?",
  browserOpenLinkDetail: "Stránka v prohlížeči chce otevřít jinou aplikaci:\n\n{url}",
  browserOpenLinkButton: "Otevřít",
  passkeyChooseTitle: "Vyberte přístupový klíč",
  exposureThisMachine: "Tento počítač",
  exposureLoopbackDescription: "Smyčkový koncový bod této desktopové aplikace.",
  exposureLocalNetwork: "Místní síť",
  exposureLocalNetworkDescription: "Dostupné ze zařízení ve stejné síti.",
  exposureCustomHttps: "Vlastní HTTPS",
  exposureCustomEndpoint: "Vlastní koncový bod",
  exposureCustomHttpsDescription:
    "Koncový bod HTTPS nastavený uživatelem pro tento desktopový backend.",
  exposureCustomEndpointDescription:
    "Koncový bod nastavený uživatelem pro tento desktopový backend.",
  exposureManualProvider: "Ručně",
  tailscaleIpLabel: "IP adresa Tailscale",
  tailscaleIpDescription: "Dostupné ze zařízení ve stejné síti Tailnet.",
  tailscaleHttpsLabel: "HTTPS přes Tailscale",
  tailscaleHttpsDescription: "Koncový bod HTTPS obsluhovaný přes Tailscale Serve.",
  tailscaleMagicDnsDescription: "Název MagicDNS. Pro přístup přes HTTPS nastavte Tailscale Serve.",
  captureHelperUpdateRequired:
    "Pro pokračování aktualizujte přiložený pomocný nástroj pro snímání.",
  gnomeUnsupportedVersion:
    "Přiložené rozšíření podporuje GNOME {versions}. Tato relace běží na GNOME {major}.",
  gnomeNotInstalled:
    "Nainstalujte přiložené rozšíření, aby šlo zachytit aktivní okno bez výběru. Stahování ani heslo správce nejsou potřeba.",
  gnomeRestartRequired:
    "Nainstalováno. Uložte práci, odhlaste se z GNOME a znovu se přihlaste, pak se sem vraťte a rozšíření zapněte. Samotný restart T3 Code nestačí.",
  gnomeUpdateRequired:
    "Tato aplikace obsahuje novější rozšíření. Nainstalujte ho, pak se odhlaste a znovu přihlaste, aby se aktualizace načetla.",
  gnomeExtensionsDisabled:
    "GNOME vypnulo uživatelská rozšíření. Zapněte Rozšíření v aplikaci GNOME Extensions a zkontrolujte to znovu. T3 Code nezapne vaše další rozšíření.",
  gnomeEnabled: "Rozšíření T3 Code běží. Snímky aktivního okna jsou dostupné.",
  gnomeLoadFailed:
    "GNOME rozšíření nenačetlo. Podrobnosti najdete v aplikaci GNOME Extensions, nebo se odhlaste a znovu přihlaste.",
  gnomeDisabled:
    "Zapněte rozšíření T3 Code, aby šlo pořizovat snímky aktivního okna. Kdykoli ho tady můžete vypnout.",
  gnomeCheckFailed: "Nastavení rozšíření GNOME se nepodařilo zkontrolovat.",
  hyprlandNotInstalled:
    "Nainstalujte přiložený pomocný nástroj, aby šlo zachytit okno, se kterým pracujete.",
  hyprlandHelperMissing:
    "Pomocný nástroj pro snímání v Hyprland v tomto sestavení chybí. Aktualizujte nebo znovu nainstalujte T3 Code.",
  hyprlandReady:
    "Pomocný nástroj je připraven. Hyprland může při prvním snímku požádat o oprávnění ke sdílení obrazovky.",
  hyprlandCheckFailed: "Přístup ke snímání v Hyprland se nepodařilo zkontrolovat.",
  kdeNotInstalled:
    "Nainstalujte přiložený pomocný nástroj, aby šlo zachytit okno, se kterým pracujete, bez výběru.",
  kdeHelperMissing:
    "Pomocný nástroj pro snímání v tomto sestavení chybí. Aktualizujte nebo znovu nainstalujte T3 Code.",
  kdeReady: "Přístup ke snímání v KDE je připraven. Dále vyberte zkratku.",
  kdeCheckFailed: "Přístup ke snímání v KDE se nepodařilo zkontrolovat.",
  snapShotShortcutTaken: "Tuto zkratku už používá systém nebo jiná aplikace.",
  snapShotShortcutRegisterFailed: "Systém tuto zkratku nedokázal zaregistrovat.",
  snapShotUnsupportedPlatform: "Snímky SnapShot na této platformě nejsou podporované.",
  snapShotNiriConfig: "Zkratku pro snímání nastavte v konfiguraci Niri, ne v T3 Code.",
  snapShotHyprlandConfig: "Změňte klávesovou vazbu pro snímání v konfiguraci Hyprland a uložte ji.",
  snapShotPortalConfirm: "Plocha tuto zkratku potvrdí, až ji uložíte.",
  snapShotUnsupportedShortcut: "Nepodporovaná zkratka.",
  snapShotRequiresWayland:
    "Snímky SnapShot vyžadují relaci Wayland. Snímání přes X11 není podporováno.",
  snapShotCaptureCheckFailed:
    "Podporu snímání na ploše se nepodařilo zkontrolovat. Zkontrolujte relaci plochy a zkuste to znovu.",
  wslNoLoopbackPort:
    "Pro WSL backend není mezi porty {startPort} a {maxPort} k dispozici žádný loopback port.",
  permissionSetupTitle: "Nastavení: {permission}",
  permissionHelperClose: "Zavřít pomocníka oprávnění",
  permissionHelperDragHint: "↑ Přetáhněte T3 Code do seznamu nahoře",
  permissionHelperDragLabel:
    "Přetáhněte T3 Code do Nastavení systému, nebo kliknutím zobrazte ve Finderu",
  snapShotErrListPending: "Nepodařilo se načíst čekající snímky.",
  snapShotErrRead: "Snímek se nepodařilo načíst.",
  snapShotErrAcknowledge: "Snímek se nepodařilo odstranit.",
  snapShotErrUnsupported: "Snímky SnapShot tady nejsou podporované.",
  snapShotErrDisabled: "Nejdřív zapněte snímky SnapShot v Nastavení.",
  snapShotErrNoWindow: "Nebylo vybráno žádné okno.",
  snapShotErrWindowUnavailable: "Aktivní okno není k snímání dostupné.",
  snapShotErrCapture: "Aktivní okno se nepodařilo zachytit.",
  snapShotConfigUnsupportedSession: "Nastavení konfigurace vyžaduje relaci Niri nebo Hyprland.",
  snapShotConfigPrepareFailed: "Změny zkratky pro snímání se nepodařilo připravit.",
  snapShotConfigSaveFailed: "Zkratku pro snímání se nepodařilo uložit.",
  snapShotHelperWaylandHyprland:
    "Nastavení pomocného nástroje vyžaduje relaci Hyprland Wayland mimo sandbox.",
  snapShotHelperWaylandKde:
    "Nastavení pomocného nástroje vyžaduje relaci KDE Plasma Wayland mimo sandbox.",
  snapShotExtensionWaylandGnome: "Nastavení rozšíření vyžaduje relaci GNOME Wayland mimo sandbox.",
  snapShotShortcutPermissionsFailed: "Oprávnění ke zkratkám se nepodařilo otevřít.",
  snapShotSetupHyprlandFailed: "Snímání v Hyprland se nepodařilo nastavit.",
  snapShotSetupKdeFailed: "Snímání v KDE se nepodařilo nastavit.",
  snapShotSetupGnomeFailed: "Rozšíření GNOME se nepodařilo nastavit.",
  snapShotNiriShortcutSetUp: "Nastavte zkratku, aby se přidala do konfigurace Niri.",
  snapShotNiriEndpointBusy:
    "Koncový bod pro snímání v Niri se nepodařilo spustit. Možná ho používá jiná instance T3 Code.",
  snapShotCapturedWindow: "Zachycené okno",
  livePreviewAlt: "Živý náhled prohlížeče",
  passkeyUnnamed: "Přístupový klíč bez názvu",
  fileFilterImages: "Obrázky",
} satisfies CzechNamespace<"desktop">;
