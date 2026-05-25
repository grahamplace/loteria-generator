import { jsPDF } from 'jspdf';
import type { LotteriaCard } from './generate-boards';

export interface CallerSheetEntry {
  number: number;
  label: string;
  riddle: string | null;
}

export interface CallerSheetLabels {
  title: string;
}

/** True when at least one card has a non-empty (trimmed) riddle. */
export function shouldIncludeCallerSheet(cards: LotteriaCard[]): boolean {
  return cards.some((c) => typeof c.riddle === 'string' && c.riddle.trim().length > 0);
}

/**
 * Ordered entries for the caller sheet: every processed card (not processing,
 * not errored) sorted by number. Riddles are trimmed; empty riddles become null.
 */
export function buildCallerSheetEntries(cards: LotteriaCard[]): CallerSheetEntry[] {
  return cards
    .filter((c) => !c.isProcessing && !c.error)
    .slice()
    .sort((a, b) => a.number - b.number)
    .map((c) => {
      const trimmed = typeof c.riddle === 'string' ? c.riddle.trim() : '';
      return {
        number: c.number,
        label: c.label,
        riddle: trimmed.length > 0 ? trimmed : null,
      };
    });
}

/**
 * Appends caller-sheet page(s) to an existing jsPDF doc using native text.
 * Assumes a letter/portrait doc created with unit 'in'. 12pt body, paginates.
 */
export function addCallerSheetPages(
  pdf: jsPDF,
  entries: CallerSheetEntry[],
  labels: CallerSheetLabels
): void {
  if (entries.length === 0) return;

  const PAGE_WIDTH = 8.5;
  const PAGE_HEIGHT = 11;
  const MARGIN = 0.75;
  const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;
  const BOTTOM = PAGE_HEIGHT - MARGIN;
  const RIDDLE_INDENT = 0.25;
  const BODY_PT = 12;
  const TITLE_PT = 18;
  const ptToIn = (pt: number) => pt / 72;
  const LINE = ptToIn(BODY_PT) * 1.15; // line advance for 12pt body
  const ENTRY_GAP = LINE * 0.6;

  pdf.addPage('letter', 'portrait');
  let y = MARGIN;

  // Title
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(TITLE_PT);
  y += ptToIn(TITLE_PT);
  pdf.text(labels.title, MARGIN, y);
  y += LINE;

  pdf.setFontSize(BODY_PT);

  for (const entry of entries) {
    pdf.setFont('helvetica', 'normal');
    const riddleLines = entry.riddle
      ? (pdf.splitTextToSize(entry.riddle, CONTENT_WIDTH - RIDDLE_INDENT) as string[])
      : [];
    const blockHeight = LINE + riddleLines.length * LINE + ENTRY_GAP;

    if (y + blockHeight > BOTTOM) {
      pdf.addPage('letter', 'portrait');
      y = MARGIN;
    }

    // Card number + name (bold)
    pdf.setFont('helvetica', 'bold');
    y += LINE;
    pdf.text(`${entry.number}. ${entry.label}`, MARGIN, y);

    // Riddle (normal, indented)
    if (riddleLines.length > 0) {
      pdf.setFont('helvetica', 'normal');
      for (const line of riddleLines) {
        y += LINE;
        pdf.text(line, MARGIN + RIDDLE_INDENT, y);
      }
    }

    y += ENTRY_GAP;
  }
}
