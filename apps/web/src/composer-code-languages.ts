import { currentTranslator } from "~/i18n/I18nProvider";

export const CODE_BLOCK_LANGUAGES = [
  {
    id: "",
    get label() {
      return currentTranslator()("shellRest.plainText");
    },
  },
  { id: "bash", label: "Bash" }, // i18n-ignore: language name in the picker
  { id: "c", label: "C" }, // i18n-ignore: language name in the picker
  { id: "cpp", label: "C++" }, // i18n-ignore: language name in the picker
  { id: "csharp", label: "C#" }, // i18n-ignore: language name in the picker
  { id: "css", label: "CSS" }, // i18n-ignore: language name in the picker
  { id: "dart", label: "Dart" }, // i18n-ignore: language name in the picker
  { id: "diff", label: "Diff" }, // i18n-ignore: language name in the picker
  { id: "dockerfile", label: "Dockerfile" }, // i18n-ignore: language name in the picker
  { id: "elixir", label: "Elixir" }, // i18n-ignore: language name in the picker
  { id: "go", label: "Go" }, // i18n-ignore: language name in the picker
  { id: "graphql", label: "GraphQL" }, // i18n-ignore: language name in the picker
  { id: "haskell", label: "Haskell" }, // i18n-ignore: language name in the picker
  { id: "html", label: "HTML" }, // i18n-ignore: language name in the picker
  { id: "java", label: "Java" }, // i18n-ignore: language name in the picker
  { id: "javascript", label: "JavaScript" }, // i18n-ignore: language name in the picker
  { id: "json", label: "JSON" }, // i18n-ignore: language name in the picker
  { id: "jsx", label: "JSX" }, // i18n-ignore: language name in the picker
  { id: "kotlin", label: "Kotlin" }, // i18n-ignore: language name in the picker
  { id: "lua", label: "Lua" }, // i18n-ignore: language name in the picker
  { id: "markdown", label: "Markdown" }, // i18n-ignore: language name in the picker
  { id: "php", label: "PHP" }, // i18n-ignore: language name in the picker
  { id: "powershell", label: "PowerShell" }, // i18n-ignore: language name in the picker
  { id: "python", label: "Python" }, // i18n-ignore: language name in the picker
  { id: "r", label: "R" }, // i18n-ignore: language name in the picker
  { id: "ruby", label: "Ruby" }, // i18n-ignore: language name in the picker
  { id: "rust", label: "Rust" }, // i18n-ignore: language name in the picker
  { id: "scala", label: "Scala" }, // i18n-ignore: language name in the picker
  { id: "scss", label: "SCSS" }, // i18n-ignore: language name in the picker
  { id: "sql", label: "SQL" }, // i18n-ignore: language name in the picker
  { id: "svelte", label: "Svelte" }, // i18n-ignore: language name in the picker
  { id: "swift", label: "Swift" }, // i18n-ignore: language name in the picker
  { id: "toml", label: "TOML" }, // i18n-ignore: language name in the picker
  { id: "tsx", label: "TSX" }, // i18n-ignore: language name in the picker
  { id: "typescript", label: "TypeScript" }, // i18n-ignore: language name in the picker
  { id: "vue", label: "Vue" }, // i18n-ignore: language name in the picker
  { id: "xml", label: "XML" }, // i18n-ignore: language name in the picker
  { id: "yaml", label: "YAML" }, // i18n-ignore: language name in the picker
  { id: "zig", label: "Zig" }, // i18n-ignore: language name in the picker
] as const;

export type CodeBlockLanguage = { readonly id: string; readonly label: string };

const LANGUAGE_ALIASES: Record<string, string> = {
  cs: "csharp",
  "c++": "cpp",
  js: "javascript",
  md: "markdown",
  py: "python",
  rb: "ruby",
  rs: "rust",
  sh: "bash",
  shell: "bash",
  ts: "typescript",
  yml: "yaml",
};

export function languageOfInfoString(info: string): string {
  return info.trim().split(/\s+/, 1)[0] ?? "";
}

/**
 * Plain text clears it, unless something follows: a bare `title=x` would read
 * as the language, so that keeps `text` in front.
 */
export function withInfoStringLanguage(info: string, language: string): string {
  const leading = /^\s*/.exec(info)![0];
  const rest = info.slice(leading.length + languageOfInfoString(info).length);
  if (language) return `${leading}${language}${rest}`;
  return rest.trim() ? `${leading}text${rest}` : "";
}

export function codeLanguageEntry(language: string): CodeBlockLanguage | null {
  const id = language === "text" ? "" : (LANGUAGE_ALIASES[language.toLowerCase()] ?? language);
  return CODE_BLOCK_LANGUAGES.find((entry) => entry.id === id.toLowerCase()) ?? null;
}

export function codeLanguageLabel(language: string): string {
  return codeLanguageEntry(language)?.label ?? language;
}
