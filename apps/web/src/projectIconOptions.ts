import { iconNames, type IconName } from "lucide-react/dynamic";
import { currentTranslator } from "~/i18n/I18nProvider";
export { PROJECT_ICON_COLORS, projectIconColorClassName } from "./projectIconColors";

const POPULAR_PROJECT_ICONS = [
  "folder-code",
  "code-2",
  "terminal",
  "globe-2",
  "server",
  "database",
  "bot",
  "sparkles",
  "smartphone",
  "monitor",
  "cloud-cog",
  "package",
  "book-open",
  "flask-conical",
  "shield-check",
  "rocket",
  "gamepad-2",
  "music",
  "image",
  "shopping-bag",
  "git-branch",
  "workflow",
  "wrench",
  "layers-3",
] as const satisfies ReadonlyArray<IconName>;

export const PROJECT_EMOJIS: ReadonlyArray<{ readonly emoji: string; readonly label: string }> = [
  {
    emoji: "💻",
    get label() {
      return currentTranslator()("shellRest.iconLabelComputer");
    },
  },
  {
    emoji: "🛠️",
    get label() {
      return currentTranslator()("shellRest.iconLabelTools");
    },
  },
  {
    emoji: "🚀",
    get label() {
      return currentTranslator()("shellRest.iconLabelRocket");
    },
  },
  {
    emoji: "🤖",
    get label() {
      return currentTranslator()("shellRest.iconLabelRobot");
    },
  },
  {
    emoji: "✨",
    get label() {
      return currentTranslator()("shellRest.iconLabelSparkles");
    },
  },
  {
    emoji: "⚡",
    get label() {
      return currentTranslator()("shellRest.iconLabelLightning");
    },
  },
  {
    emoji: "🌐",
    get label() {
      return currentTranslator()("shellRest.iconLabelWeb");
    },
  },
  {
    emoji: "📱",
    get label() {
      return currentTranslator()("shellRest.iconLabelMobile");
    },
  },
  {
    emoji: "🖥️",
    get label() {
      return currentTranslator()("shellRest.iconLabelDesktop");
    },
  },
  {
    emoji: "⌨️",
    get label() {
      return currentTranslator()("shellRest.iconLabelKeyboard");
    },
  },
  {
    emoji: "⚙️",
    get label() {
      return currentTranslator()("shellRest.iconLabelGear");
    },
  },
  {
    emoji: "🗄️",
    get label() {
      return currentTranslator()("shellRest.iconLabelDatabase");
    },
  },
  {
    emoji: "☁️",
    get label() {
      return currentTranslator()("shellRest.iconLabelCloud");
    },
  },
  {
    emoji: "📦",
    get label() {
      return currentTranslator()("shellRest.iconLabelPackage");
    },
  },
  {
    emoji: "📚",
    get label() {
      return currentTranslator()("shellRest.iconLabelBooks");
    },
  },
  {
    emoji: "🧪",
    get label() {
      return currentTranslator()("shellRest.iconLabelTestTube");
    },
  },
  {
    emoji: "🔒",
    get label() {
      return currentTranslator()("shellRest.iconLabelLock");
    },
  },
  {
    emoji: "🎮",
    get label() {
      return currentTranslator()("shellRest.iconLabelGame");
    },
  },
  {
    emoji: "🎵",
    get label() {
      return currentTranslator()("shellRest.iconLabelMusic");
    },
  },
  {
    emoji: "🎬",
    get label() {
      return currentTranslator()("shellRest.iconLabelMovie");
    },
  },
  {
    emoji: "🖼️",
    get label() {
      return currentTranslator()("shellRest.iconLabelPicture");
    },
  },
  {
    emoji: "🛍️",
    get label() {
      return currentTranslator()("shellRest.iconLabelShopping");
    },
  },
  {
    emoji: "🔥",
    get label() {
      return currentTranslator()("shellRest.iconLabelFire");
    },
  },
  {
    emoji: "💡",
    get label() {
      return currentTranslator()("shellRest.iconLabelIdea");
    },
  },
  {
    emoji: "🧩",
    get label() {
      return currentTranslator()("shellRest.iconLabelPuzzle");
    },
  },
  {
    emoji: "📊",
    get label() {
      return currentTranslator()("shellRest.iconLabelChart");
    },
  },
  {
    emoji: "🧠",
    get label() {
      return currentTranslator()("shellRest.iconLabelBrain");
    },
  },
  {
    emoji: "🦄",
    get label() {
      return currentTranslator()("shellRest.iconLabelUnicorn");
    },
  },
  {
    emoji: "🐙",
    get label() {
      return currentTranslator()("shellRest.iconLabelOctopus");
    },
  },
  {
    emoji: "🌱",
    get label() {
      return currentTranslator()("shellRest.iconLabelSeedling");
    },
  },
];

export function filterProjectIconNames(query: string): ReadonlyArray<IconName> {
  const normalized = query.trim().toLowerCase().replaceAll(/\s+/g, "-");
  if (!normalized) return POPULAR_PROJECT_ICONS;
  return iconNames.filter((name) => name.includes(normalized)).slice(0, 60);
}

export function firstEmoji(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const segments = new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(trimmed);
  const segment = segments[Symbol.iterator]().next().value?.segment;
  const isFlag = /^\p{Regional_Indicator}{2}$/u.test(segment ?? "");
  const isKeycap = /^[#*0-9]\uFE0F?\u20E3$/u.test(segment ?? "");
  if (!segment || (!/\p{Extended_Pictographic}/u.test(segment) && !isFlag && !isKeycap)) {
    return null;
  }
  return segment;
}
