import {
  Document,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
  PageBreak,
  Packer,
  BorderStyle,
} from 'docx';

/* ---------- types ---------- */
interface DraftItem {
  item_code: string;
  item_name: string;
  category_number: number;
  category_name: string;
  points: number;
  item_type: string;
  narrative_text: string;
  word_count: number;
  status: string;
}

/* ---------- markdown → docx paragraphs ---------- */

/**
 * Simple markdown-to-docx converter.
 * Handles: headings (##, ###), bold (**), italic (*), bullet lists (- ), numbered lists,
 * gap markers ([GAP: ...]), and regular paragraphs.
 */
function markdownToParagraphs(markdown: string): Paragraph[] {
  const paragraphs: Paragraph[] = [];
  const lines = markdown.split('\n');
  let i = 0;

  while (i < lines.length) {
    const line = lines[i].trimEnd();

    // Skip empty lines
    if (line.trim() === '') {
      i++;
      continue;
    }

    // Heading 2 (## )
    if (line.startsWith('## ')) {
      paragraphs.push(
        new Paragraph({
          heading: HeadingLevel.HEADING_2,
          children: parseInlineFormatting(line.slice(3)),
          spacing: { before: 240, after: 120 },
        })
      );
      i++;
      continue;
    }

    // Heading 3 (### )
    if (line.startsWith('### ')) {
      paragraphs.push(
        new Paragraph({
          heading: HeadingLevel.HEADING_3,
          children: parseInlineFormatting(line.slice(4)),
          spacing: { before: 200, after: 80 },
        })
      );
      i++;
      continue;
    }

    // Heading 4 (#### )
    if (line.startsWith('#### ')) {
      paragraphs.push(
        new Paragraph({
          heading: HeadingLevel.HEADING_4,
          children: parseInlineFormatting(line.slice(5)),
          spacing: { before: 160, after: 60 },
        })
      );
      i++;
      continue;
    }

    // Bullet list item (- or * )
    if (/^[-*] /.test(line.trim())) {
      paragraphs.push(
        new Paragraph({
          bullet: { level: 0 },
          children: parseInlineFormatting(line.trim().slice(2)),
          spacing: { before: 40, after: 40 },
        })
      );
      i++;
      continue;
    }

    // Numbered list item
    const numMatch = line.trim().match(/^(\d+)\.\s+(.+)/);
    if (numMatch) {
      paragraphs.push(
        new Paragraph({
          numbering: { reference: 'numbered-list', level: 0 },
          children: parseInlineFormatting(numMatch[2]),
          spacing: { before: 40, after: 40 },
        })
      );
      i++;
      continue;
    }

    // Gap marker [GAP: ...]
    if (line.includes('[GAP:')) {
      paragraphs.push(
        new Paragraph({
          children: [
            new TextRun({
              text: line.trim(),
              color: 'CC0000',
              bold: true,
              italics: true,
              size: 22,
            }),
          ],
          spacing: { before: 80, after: 80 },
          border: {
            left: {
              style: BorderStyle.SINGLE,
              size: 6,
              color: 'CC0000',
              space: 8,
            },
          },
        })
      );
      i++;
      continue;
    }

    // Horizontal rule (---)
    if (/^---+$/.test(line.trim())) {
      paragraphs.push(
        new Paragraph({
          children: [],
          border: {
            bottom: { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' },
          },
          spacing: { before: 120, after: 120 },
        })
      );
      i++;
      continue;
    }

    // Regular paragraph
    paragraphs.push(
      new Paragraph({
        children: parseInlineFormatting(line.trim()),
        spacing: { before: 60, after: 60 },
      })
    );
    i++;
  }

  return paragraphs;
}

/**
 * Parse bold (**text**) and italic (*text*) inline formatting.
 */
function parseInlineFormatting(text: string): TextRun[] {
  const runs: TextRun[] = [];
  // Regex to find **bold**, *italic*, and `code` patterns
  const pattern = /(\*\*(.+?)\*\*)|(\*(.+?)\*)|(`(.+?)`)/g;
  let lastIndex = 0;
  let match;

  while ((match = pattern.exec(text)) !== null) {
    // Add preceding plain text
    if (match.index > lastIndex) {
      runs.push(new TextRun({ text: text.slice(lastIndex, match.index), size: 22 }));
    }

    if (match[2]) {
      // Bold
      runs.push(new TextRun({ text: match[2], bold: true, size: 22 }));
    } else if (match[4]) {
      // Italic
      runs.push(new TextRun({ text: match[4], italics: true, size: 22 }));
    } else if (match[6]) {
      // Code
      runs.push(new TextRun({ text: match[6], font: 'Courier New', size: 20, color: '666666' }));
    }

    lastIndex = match.index + match[0].length;
  }

  // Add remaining plain text
  if (lastIndex < text.length) {
    runs.push(new TextRun({ text: text.slice(lastIndex), size: 22 }));
  }

  // If no text at all, add an empty run
  if (runs.length === 0) {
    runs.push(new TextRun({ text: text, size: 22 }));
  }

  return runs;
}

/* ---------- main export ---------- */

export async function generateApplicationDocx(draftItems: DraftItem[]): Promise<Blob> {
  // Group by category
  const categories = new Map<number, { name: string; items: DraftItem[] }>();
  for (const item of draftItems) {
    const existing = categories.get(item.category_number) || {
      name: item.category_name,
      items: [],
    };
    existing.items.push(item);
    categories.set(item.category_number, existing);
  }

  // Sort categories: P (0) first, then 1-7
  const sortedCategories = [...categories.entries()].sort(([a], [b]) => a - b);

  // Calculate total words
  const totalWords = draftItems.reduce((s, d) => s + d.word_count, 0);

  // Build document sections
  const children: Paragraph[] = [];

  // ---- Title page ----
  children.push(
    new Paragraph({ spacing: { before: 2400 } }), // Top margin
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [
        new TextRun({
          text: 'NIA Excellence Hub',
          bold: true,
          size: 52,
          color: '2A2A2A',
        }),
      ],
      spacing: { after: 200 },
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [
        new TextRun({
          text: 'Baldrige Excellence Builder Application',
          size: 36,
          color: '555555',
        }),
      ],
      spacing: { after: 400 },
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [
        new TextRun({
          text: 'Northern Illinois Academy',
          size: 28,
          color: '777777',
        }),
      ],
      spacing: { after: 100 },
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [
        new TextRun({
          text: new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long' }),
          size: 24,
          color: '999999',
        }),
      ],
      spacing: { after: 600 },
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [
        new TextRun({
          text: `${totalWords.toLocaleString()} words · ${Math.round(totalWords / 500)} estimated pages`,
          size: 20,
          color: 'AAAAAA',
          italics: true,
        }),
      ],
    }),
    new Paragraph({ children: [new PageBreak()] })
  );

  // ---- Table of Contents (manual) ----
  children.push(
    new Paragraph({
      heading: HeadingLevel.HEADING_1,
      children: [new TextRun({ text: 'Contents', size: 32, bold: true })],
      spacing: { after: 200 },
    })
  );

  // Build manual TOC from categories and items
  for (const [catNum, cat] of sortedCategories) {
    const catLabel = catNum === 0 ? 'Organizational Profile' : `Category ${catNum}: ${cat.name}`;
    children.push(
      new Paragraph({
        children: [new TextRun({ text: catLabel, bold: true, size: 22 })],
        spacing: { before: 80, after: 40 },
      })
    );
    for (const item of cat.items) {
      const wordInfo =
        item.word_count > 0 ? ` (${item.word_count.toLocaleString()} words)` : ' (no draft)';
      children.push(
        new Paragraph({
          children: [
            new TextRun({ text: `    ${item.item_code} ${item.item_name}`, size: 20 }),
            new TextRun({ text: wordInfo, size: 20, color: '999999', italics: true }),
          ],
          spacing: { before: 20, after: 20 },
        })
      );
    }
  }

  children.push(new Paragraph({ children: [new PageBreak()] }));

  // ---- Category sections ----
  for (const [catNum, cat] of sortedCategories) {
    const catLabel = catNum === 0 ? 'Organizational Profile' : `Category ${catNum}: ${cat.name}`;
    const catPoints = cat.items.reduce((s, i) => s + i.points, 0);
    const catWords = cat.items.reduce((s, i) => s + i.word_count, 0);

    // Category heading
    children.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_1,
        children: [
          new TextRun({
            text: catLabel,
            size: 32,
            bold: true,
          }),
        ],
        spacing: { before: 400, after: 100 },
      }),
      new Paragraph({
        children: [
          new TextRun({
            text: `${catPoints} points · ${cat.items.length} items · ${catWords.toLocaleString()} words`,
            size: 20,
            color: '888888',
            italics: true,
          }),
        ],
        spacing: { after: 200 },
      })
    );

    // Items within category
    for (const item of cat.items) {
      // Item heading
      children.push(
        new Paragraph({
          heading: HeadingLevel.HEADING_2,
          children: [
            new TextRun({
              text: `${item.item_code} ${item.item_name}`,
              size: 26,
              bold: true,
            }),
            new TextRun({
              text: ` (${item.points} points)`,
              size: 22,
              color: '888888',
            }),
          ],
          spacing: { before: 300, after: 120 },
        })
      );

      if (item.narrative_text) {
        // Convert markdown narrative to docx paragraphs
        const narrativeParagraphs = markdownToParagraphs(item.narrative_text);
        children.push(...narrativeParagraphs);
      } else {
        // No draft yet
        children.push(
          new Paragraph({
            children: [
              new TextRun({
                text: '[No narrative drafted yet for this item]',
                italics: true,
                color: '999999',
                size: 22,
              }),
            ],
            spacing: { before: 80, after: 80 },
          })
        );
      }

      // Space between items
      children.push(new Paragraph({ spacing: { after: 200 } }));
    }

    // Page break between categories (except last)
    const lastCat = sortedCategories[sortedCategories.length - 1];
    if (catNum !== lastCat[0]) {
      children.push(new Paragraph({ children: [new PageBreak()] }));
    }
  }

  // Build document
  const doc = new Document({
    numbering: {
      config: [
        {
          reference: 'numbered-list',
          levels: [
            {
              level: 0,
              format: 'decimal',
              text: '%1.',
              alignment: AlignmentType.LEFT,
            },
          ],
        },
      ],
    },
    styles: {
      default: {
        document: {
          run: {
            font: 'Calibri',
            size: 22,
          },
        },
      },
    },
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: 1440, // 1 inch
              bottom: 1440,
              left: 1440,
              right: 1440,
            },
          },
        },
        children,
      },
    ],
  });

  return Packer.toBlob(doc);
}
