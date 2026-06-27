/**
 * StudyNotesPDFDocument — @react-pdf/renderer Document component for Phase 5.
 *
 * Renders a PDF with:
 *   - Topic header ("Study Notes: {topic}")
 *   - Markdown-stripped notes body
 *   - YouTube URL footer ("Source: {youtubeUrl}")
 *
 * No 'use client' — uses only @react-pdf/renderer primitives (Document, Page, View, Text).
 * These are renderable server-side. PDFDownloadLink (web-only) lives in status-view.tsx
 * and is loaded via dynamic() with ssr: false.
 */

import { Document, Page, View, Text, StyleSheet } from '@react-pdf/renderer'

const styles = StyleSheet.create({
  page: { padding: 48, fontFamily: 'Helvetica' },
  title: { fontSize: 20, fontWeight: 'bold', color: '#1a1a1a', marginBottom: 8 },
  divider: { height: 1, backgroundColor: '#e5e5e5', marginBottom: 16 },
  body: { fontSize: 16, lineHeight: 1.6, color: '#1a1a1a' },
  footer: { fontSize: 10, color: '#6b7280', marginTop: 24 },
})

/**
 * stripMarkdown — strip Markdown syntax characters before passing to PDF Text node.
 *
 * @react-pdf/renderer Text nodes are plain text; raw Markdown characters (##, **, -, `)
 * would appear literally in the PDF body.
 */
function stripMarkdown(md: string): string {
  return md
    .replace(/#{1,6}\s+/g, '')          // headings: ## Heading → Heading
    .replace(/\*\*(.+?)\*\*/g, '$1')    // bold: **text** → text
    .replace(/\*(.+?)\*/g, '$1')        // italic: *text* → text
    .replace(/^[-*]\s+/gm, '• ')        // list bullets: - item → • item
    .replace(/`{1,3}/g, '')             // code ticks: `code` → code
    .trim()
}

export interface StudyNotesPDFDocumentProps {
  topic: string
  studyNotes: string
  youtubeUrl: string
}

/**
 * Named export — consumed via:
 *   import { StudyNotesPDFDocument } from './StudyNotesPDFDocument'
 * in status-view.tsx (passed as document prop to PDFDownloadLink).
 */
export function StudyNotesPDFDocument({ topic, studyNotes, youtubeUrl }: StudyNotesPDFDocumentProps) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View>
          <Text style={styles.title}>Study Notes: {topic}</Text>
        </View>
        <View style={styles.divider} />
        <View>
          <Text style={styles.body}>{stripMarkdown(studyNotes)}</Text>
        </View>
        <View>
          <Text style={styles.footer}>Source: {youtubeUrl}</Text>
        </View>
      </Page>
    </Document>
  )
}
