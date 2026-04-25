import React from "react";
import { Text, View, StyleSheet } from "@react-pdf/renderer";
import type { Style } from "@react-pdf/types";
import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import type { Root, RootContent, PhrasingContent, ListItem } from "mdast";

const styles = StyleSheet.create({
  paragraph: {
    marginBottom: 10,
    lineHeight: 1.55,
  },
  heading1: {
    fontSize: 18,
    fontFamily: "Times-Bold",
    marginTop: 16,
    marginBottom: 8,
  },
  heading2: {
    fontSize: 15,
    fontFamily: "Times-Bold",
    marginTop: 14,
    marginBottom: 6,
  },
  heading3: {
    fontSize: 13,
    fontFamily: "Times-Bold",
    marginTop: 12,
    marginBottom: 5,
  },
  heading4: {
    fontSize: 12,
    fontFamily: "Times-Bold",
    marginTop: 10,
    marginBottom: 4,
  },
  blockquote: {
    marginLeft: 14,
    marginBottom: 10,
    paddingLeft: 10,
    borderLeftWidth: 2,
    borderLeftColor: "#CBD5E1",
    color: "#475569",
  },
  code: {
    fontFamily: "Courier",
    fontSize: 10,
    backgroundColor: "#F1F5F9",
    padding: 6,
    marginBottom: 10,
  },
  list: {
    marginBottom: 10,
  },
  listItem: {
    flexDirection: "row",
    marginBottom: 4,
    lineHeight: 1.55,
  },
  listMarker: {
    width: 22,
  },
  listContent: {
    flex: 1,
  },
  hr: {
    borderBottomWidth: 1,
    borderBottomColor: "#CBD5E1",
    marginVertical: 12,
  },
  inlineCode: {
    fontFamily: "Courier",
    fontSize: 10,
    backgroundColor: "#F1F5F9",
  },
  link: {
    color: "#1E40AF",
    textDecoration: "underline",
  },
});

type InlineStyle = { bold?: boolean; italic?: boolean; strike?: boolean };

function renderInline(
  nodes: PhrasingContent[],
  parentStyle: InlineStyle = {},
  keyPrefix = "i",
): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  nodes.forEach((node, idx) => {
    const key = `${keyPrefix}-${idx}`;
    switch (node.type) {
      case "text":
        out.push(
          <Text key={key} style={fontStyleFor(parentStyle)}>
            {node.value}
          </Text>,
        );
        break;
      case "strong":
        out.push(
          ...renderInline(node.children, { ...parentStyle, bold: true }, key),
        );
        break;
      case "emphasis":
        out.push(
          ...renderInline(node.children, { ...parentStyle, italic: true }, key),
        );
        break;
      case "delete":
        out.push(
          ...renderInline(node.children, { ...parentStyle, strike: true }, key),
        );
        break;
      case "inlineCode":
        out.push(
          <Text key={key} style={styles.inlineCode}>
            {node.value}
          </Text>,
        );
        break;
      case "break":
        out.push(<Text key={key}>{"\n"}</Text>);
        break;
      case "link":
        out.push(
          <Text key={key} style={styles.link}>
            {renderInline(node.children, parentStyle, key)}
          </Text>,
        );
        break;
      default:
        // Unknown/unsupported inline node — skip silently.
        break;
    }
  });
  return out;
}

function fontStyleFor(s: InlineStyle): Style {
  const props: Style = {};
  if (s.bold && s.italic) props.fontFamily = "Times-BoldItalic";
  else if (s.bold) props.fontFamily = "Times-Bold";
  else if (s.italic) props.fontFamily = "Times-Italic";
  if (s.strike) props.textDecoration = "line-through";
  return props;
}

function renderListItems(
  items: ListItem[],
  ordered: boolean,
  start: number,
  keyPrefix: string,
): React.ReactNode[] {
  return items.map((item, idx) => {
    const marker = ordered ? `${start + idx}.` : "•";
    const content = item.children.flatMap((child, ci) =>
      renderBlock(child, `${keyPrefix}-${idx}-${ci}`, { insideListItem: true }),
    );
    return (
      <View
        key={`${keyPrefix}-${idx}`}
        style={styles.listItem}
        wrap={false}
      >
        <Text style={styles.listMarker}>{marker}</Text>
        <View style={styles.listContent}>{content}</View>
      </View>
    );
  });
}

function renderBlock(
  node: RootContent,
  key: string,
  opts: { insideListItem?: boolean } = {},
): React.ReactNode[] {
  switch (node.type) {
    case "paragraph": {
      const style = opts.insideListItem
        ? { marginBottom: 4, lineHeight: 1.55 }
        : styles.paragraph;
      return [
        <Text key={key} style={style}>
          {renderInline(node.children, {}, key)}
        </Text>,
      ];
    }
    case "heading": {
      const map: Record<number, Style> = {
        1: styles.heading1,
        2: styles.heading2,
        3: styles.heading3,
        4: styles.heading4,
        5: styles.heading4,
        6: styles.heading4,
      };
      return [
        <Text key={key} style={map[node.depth] ?? styles.heading4}>
          {renderInline(node.children, { bold: true }, key)}
        </Text>,
      ];
    }
    case "list":
      return [
        <View key={key} style={styles.list}>
          {renderListItems(
            node.children,
            !!node.ordered,
            node.start ?? 1,
            key,
          )}
        </View>,
      ];
    case "blockquote":
      return [
        <View key={key} style={styles.blockquote}>
          {node.children.flatMap((c, ci) => renderBlock(c, `${key}-${ci}`))}
        </View>,
      ];
    case "code":
      return [
        <Text key={key} style={styles.code}>
          {node.value}
        </Text>,
      ];
    case "thematicBreak":
      return [<View key={key} style={styles.hr} />];
    case "html":
      // Render raw HTML fragments as plain text so users don't see them
      // silently dropped. Content is author-trusted markdown.
      return [
        <Text key={key} style={styles.paragraph}>
          {node.value}
        </Text>,
      ];
    default:
      return [];
  }
}

export function renderMarkdownToPdfNodes(markdown: string): React.ReactNode {
  const tree = unified()
    .use(remarkParse)
    .use(remarkGfm)
    .parse(markdown) as Root;

  return tree.children.flatMap((node, idx) =>
    renderBlock(node, `b-${idx}`),
  );
}
