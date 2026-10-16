export type RichNode = string | { readonly tag: string; readonly children: RichNode[] };

type Frame = { tag: string; opening: string; children: RichNode[] };

const TAG = /<(\/?)([A-Za-z][\w-]*)>/g;

function append(children: RichNode[], node: RichNode) {
  const last = children.at(-1);
  if (typeof node === "string" && typeof last === "string") {
    children[children.length - 1] = last + node;
  } else if (node !== "") {
    children.push(node);
  }
}

/**
 * Splits a message such as "Read the <link>docs</link>." into text and tagged
 * spans, so a sentence with a link stays one translatable string. Markup that
 * does not pair up is kept as literal text rather than dropped.
 */
export function parseRichMessage(text: string): RichNode[] {
  const root: Frame = { tag: "", opening: "", children: [] };
  const stack: Frame[] = [root];
  let cursor = 0;
  for (const match of text.matchAll(TAG)) {
    const [raw, closing, tag] = match;
    const current = stack.at(-1)!;
    append(current.children, text.slice(cursor, match.index));
    cursor = match.index + raw.length;
    if (!closing) {
      stack.push({ tag: tag!, opening: raw, children: [] });
    } else if (stack.length > 1 && current.tag === tag) {
      stack.pop();
      append(stack.at(-1)!.children, { tag: current.tag, children: current.children });
    } else {
      append(current.children, raw);
    }
  }
  append(stack.at(-1)!.children, text.slice(cursor));
  while (stack.length > 1) {
    const unclosed = stack.pop()!;
    const parent = stack.at(-1)!;
    append(parent.children, unclosed.opening);
    for (const child of unclosed.children) append(parent.children, child);
  }
  return root.children;
}
