import {
  interpolate,
  type MessageKey,
  type MessageParams,
  parseRichMessage,
  type RichNode,
} from "@t3tools/client-runtime/i18n";
import { Fragment, type ReactNode } from "react";

import { useT } from "./I18nProvider";

export type TransComponents = Readonly<Record<string, (children: ReactNode) => ReactNode>>;

const NO_COMPONENTS: TransComponents = {};

function renderNodes(
  nodes: readonly RichNode[],
  params: MessageParams | undefined,
  components: TransComponents,
): ReactNode[] {
  return nodes.map((node, index) => {
    if (typeof node === "string") {
      return params ? interpolate(node, params) : node;
    }
    const children = renderNodes(node.children, params, components);
    const render = components[node.tag];
    // A parsed message is static, so position is the node's identity.
    // oxlint-disable-next-line react/no-array-index-key
    return <Fragment key={index}>{render ? render(children) : children}</Fragment>;
  });
}

/**
 * Renders a message with markup, such as "Read the <link>docs</link>.", by
 * mapping each tag to a component. Parameters are filled after parsing, so a
 * value like a file name can never inject a tag.
 */
export function Trans({
  k,
  params,
  components = NO_COMPONENTS,
}: {
  readonly k: MessageKey;
  readonly params?: MessageParams;
  readonly components?: TransComponents;
}) {
  const t = useT();
  // Only the count is applied up front, since it picks the plural form.
  const template = t(k, params?.count === undefined ? undefined : { count: params.count });
  return <>{renderNodes(parseRichMessage(template), params, components)}</>;
}
