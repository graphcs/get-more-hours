import React from "react";
import {
  Document,
  Page,
  View,
  Text,
  StyleSheet,
} from "@react-pdf/renderer";
import { renderMarkdownToPdfNodes } from "./markdown-to-pdf";

const styles = StyleSheet.create({
  page: {
    paddingTop: 72,
    paddingBottom: 72,
    paddingHorizontal: 72,
    fontFamily: "Times-Roman",
    fontSize: 11,
    color: "#0F172A",
  },
  titleBar: {
    marginBottom: 18,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
  },
  title: {
    fontSize: 13,
    fontFamily: "Times-Bold",
  },
  subtitle: {
    fontSize: 10,
    color: "#64748B",
    marginTop: 2,
  },
  pageNumber: {
    position: "absolute",
    bottom: 30,
    right: 72,
    fontSize: 9,
    color: "#94A3B8",
  },
});

export interface LetterPdfProps {
  content: string;
  title?: string;
  subtitle?: string;
}

export function LetterPdfDocument({
  content,
  title,
  subtitle,
}: LetterPdfProps) {
  const body = renderMarkdownToPdfNodes(content);
  return (
    <Document title={title} author={subtitle}>
      <Page size="LETTER" style={styles.page} wrap>
        {(title || subtitle) && (
          <View style={styles.titleBar} fixed>
            {title && <Text style={styles.title}>{title}</Text>}
            {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
          </View>
        )}
        {body}
        <Text
          style={styles.pageNumber}
          render={({ pageNumber, totalPages }) =>
            totalPages > 1 ? `Page ${pageNumber} of ${totalPages}` : ""
          }
          fixed
        />
      </Page>
    </Document>
  );
}
