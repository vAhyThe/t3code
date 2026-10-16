#!/usr/bin/env node
// @effect-diagnostics nodeBuiltinImport:off globalConsole:off - A small synchronous CLI that prints its findings.
/**
 * Lists strings that look user-facing but are not translated yet, so a rebase
 * onto a new upstream release shows exactly which new texts need a catalog key.
 *
 *   node scripts/i18n-audit.ts [path…]
 *
 * Prints `file:line: text` per candidate and exits 1 when it finds any. A
 * deliberate literal (brand, endonym, command) is marked with an
 * `i18n-ignore: <reason>` comment on its line, or alone on the line above.
 */
import * as NodeFS from "node:fs";
import * as NodePath from "node:path";
import * as NodeProcess from "node:process";
// The audit needs the compiler API, which TypeScript 7 no longer exports.
import ts from "typescript-legacy";

export interface Candidate {
  readonly line: number;
  readonly text: string;
}

const DEFAULT_PATHS = ["apps/web/src", "apps/desktop/src"];
const SKIPPED_FILE = /\.(test|stories|bench)\.[cm]?tsx?$|\.d\.ts$/;
const SOURCE_FILE = /\.[cm]?tsx?$/;
const LABEL_ATTRIBUTES = new Set([
  "title",
  "label",
  "placeholder",
  "aria-label",
  "accessibilityLabel",
  "description",
  "tooltip",
]);
const LABEL_PROPERTIES = new Set(["title", "label", "description", "message"]);
const IGNORE_MARKER = "i18n-ignore:";
const STARTS_UPPERCASE = /^\p{Lu}/u;
const HAS_LETTER = /\p{L}/u;

/** String literals an expression can evaluate to, through ternaries and fallbacks. */
function literalsOf(expression: ts.Expression): ts.Node[] {
  if (ts.isParenthesizedExpression(expression)) return literalsOf(expression.expression);
  if (ts.isConditionalExpression(expression)) {
    return [...literalsOf(expression.whenTrue), ...literalsOf(expression.whenFalse)];
  }
  if (
    ts.isBinaryExpression(expression) &&
    (expression.operatorToken.kind === ts.SyntaxKind.QuestionQuestionToken ||
      expression.operatorToken.kind === ts.SyntaxKind.BarBarToken)
  ) {
    return [...literalsOf(expression.left), ...literalsOf(expression.right)];
  }
  if (
    ts.isStringLiteral(expression) ||
    ts.isNoSubstitutionTemplateLiteral(expression) ||
    ts.isTemplateExpression(expression)
  ) {
    return [expression];
  }
  return [];
}

function literalText(node: ts.Node, sourceFile: ts.SourceFile): string {
  return ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)
    ? node.text
    : node.getText(sourceFile);
}

/** The literal parts of a template, which decide whether it reads as prose. */
function staticText(node: ts.Node): string {
  if (ts.isTemplateExpression(node)) {
    return node.head.text + node.templateSpans.map((span) => span.literal.text).join("");
  }
  return ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node) ? node.text : "";
}

function nameOf(name: ts.Node): string | null {
  if (ts.isIdentifier(name) || ts.isStringLiteral(name)) return name.text;
  if (ts.isJsxNamespacedName(name)) return `${name.namespace.text}:${name.name.text}`;
  return null;
}

export function auditSource(fileName: string, sourceText: string): Candidate[] {
  const sourceFile = ts.createSourceFile(
    fileName,
    sourceText,
    ts.ScriptTarget.Latest,
    true,
    fileName.endsWith("x") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
  const lines = sourceText.split("\n");
  const isIgnored = (line: number) => {
    const current = lines[line - 1] ?? "";
    const above = (lines[line - 2] ?? "").trim();
    return (
      current.includes(IGNORE_MARKER) ||
      (above.includes(IGNORE_MARKER) && /^(\/\/|\{?\/\*)/.test(above))
    );
  };
  const candidates: Candidate[] = [];
  const report = (position: number, text: string) => {
    const line = sourceFile.getLineAndCharacterOfPosition(position).line + 1;
    // One finding per output line, even for a template that spans several.
    if (!isIgnored(line)) candidates.push({ line, text: text.replace(/\s+/g, " ") });
  };
  const reportLiterals = (expression: ts.Expression, requireUppercase: boolean) => {
    for (const literal of literalsOf(expression)) {
      const content = staticText(literal);
      if (!HAS_LETTER.test(content)) continue;
      if (requireUppercase && !STARTS_UPPERCASE.test(content.trim())) continue;
      report(literal.getStart(sourceFile), literalText(literal, sourceFile));
    }
  };

  const visit = (node: ts.Node) => {
    if (ts.isJsxText(node)) {
      const text = node.text.trim();
      if (STARTS_UPPERCASE.test(text)) {
        report(node.getStart(sourceFile) + node.text.indexOf(text), text);
      }
    } else if (
      ts.isJsxExpression(node) &&
      node.expression &&
      (ts.isJsxElement(node.parent) || ts.isJsxFragment(node.parent))
    ) {
      reportLiterals(node.expression, true);
    } else if (ts.isJsxAttribute(node) && node.initializer) {
      const name = nameOf(node.name);
      if (name && LABEL_ATTRIBUTES.has(name)) {
        if (ts.isStringLiteral(node.initializer)) {
          reportLiterals(node.initializer, false);
        } else if (ts.isJsxExpression(node.initializer) && node.initializer.expression) {
          reportLiterals(node.initializer.expression, false);
        }
      }
    } else if (ts.isPropertyAssignment(node)) {
      const name = nameOf(node.name);
      if (name && LABEL_PROPERTIES.has(name)) reportLiterals(node.initializer, false);
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return candidates;
}

function collectFiles(path: string): string[] {
  const stat = NodeFS.statSync(path);
  if (stat.isFile()) return SOURCE_FILE.test(path) && !SKIPPED_FILE.test(path) ? [path] : [];
  return NodeFS.readdirSync(path, { withFileTypes: true })
    .filter((entry) => entry.name !== "node_modules" && !entry.name.startsWith("."))
    .toSorted((left, right) => left.name.localeCompare(right.name))
    .flatMap((entry) => collectFiles(NodePath.join(path, entry.name)));
}

if (import.meta.main) {
  const paths = NodeProcess.argv.slice(2);
  let count = 0;
  for (const file of (paths.length > 0 ? paths : DEFAULT_PATHS).flatMap(collectFiles)) {
    for (const candidate of auditSource(file, NodeFS.readFileSync(file, "utf8"))) {
      count += 1;
      console.log(`${file}:${candidate.line}: ${candidate.text}`);
    }
  }
  console.error(`${count} untranslated candidate${count === 1 ? "" : "s"}`);
  process.exitCode = count > 0 ? 1 : 0;
}
