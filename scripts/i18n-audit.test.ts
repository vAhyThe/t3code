import { describe, expect, it } from "vite-plus/test";

import { auditSource } from "./i18n-audit.ts";

const texts = (file: string, source: string) => auditSource(file, source).map((c) => c.text);

describe("auditSource", () => {
  it("flags capitalized JSX text and string literals rendered as children", () => {
    const source = `const a = <p>Delete thread</p>;
const b = <p>{done ? "Done" : "Edit"}</p>;
const c = <p>lowercase stays</p>;`;
    expect(texts("a.tsx", source)).toEqual(["Delete thread", "Done", "Edit"]);
  });

  it("flags literal user-facing props and object fields", () => {
    const source = `const a = <Button aria-label="Close panel" title={x ? "Open" : "Closed"} />;
const b = { title: "Saved", description: \`Saved \${name}\`, id: "Ignored" };
const menu = [{ label: "Copy link" }];`;
    expect(texts("a.tsx", source)).toEqual([
      "Close panel",
      "Open",
      "Closed",
      "Saved",
      "`Saved ${name}`",
      "Copy link",
    ]);
  });

  it("skips a candidate marked with an i18n-ignore comment on its line or alone above it", () => {
    const source = `const a = { title: "Codex" }; // i18n-ignore: brand
const b = <p>
  {/* i18n-ignore: brand */}
  GitHub
</p>;
const c = { title: "Flagged" };`;
    expect(texts("a.tsx", source)).toEqual(["Flagged"]);
  });

  it("keeps a multi-line candidate on one line", () => {
    const source = "const a = { message: `Failed to\n  save ${name}` };";
    expect(texts("a.ts", source)).toEqual(["`Failed to save ${name}`"]);
  });

  it("reports the line of each candidate", () => {
    const source = `const a = 1;\nconst b = { message: "Copied" };`;
    expect(auditSource("a.ts", source)).toEqual([{ line: 2, text: "Copied" }]);
  });
});
