import { describe, expect, it } from "vite-plus/test";

import { parseRichMessage } from "./richText.ts";

describe("parseRichMessage", () => {
  it("parses a tagged span", () => {
    expect(parseRichMessage("Read the <link>docs</link>.")).toEqual([
      "Read the ",
      { tag: "link", children: ["docs"] },
      ".",
    ]);
  });

  it("parses nested tags", () => {
    expect(parseRichMessage("<link>the <b>new</b> docs</link>")).toEqual([
      { tag: "link", children: ["the ", { tag: "b", children: ["new"] }, " docs"] },
    ]);
  });

  it("returns an unclosed tag as plain text", () => {
    expect(parseRichMessage("Read the <link>docs.")).toEqual(["Read the <link>docs."]);
  });

  it("keeps closed tags inside an unclosed one", () => {
    expect(parseRichMessage("a <x>b <b>c</b> d")).toEqual([
      "a <x>b ",
      { tag: "b", children: ["c"] },
      " d",
    ]);
  });

  it("returns a stray closing tag as plain text", () => {
    expect(parseRichMessage("a </b> c")).toEqual(["a </b> c"]);
  });
});
