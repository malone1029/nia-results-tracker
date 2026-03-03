import { createSupabaseServer } from '@/lib/supabase-server';
import { PDFDocument, PDFFont, StandardFonts, rgb, PDFPage } from 'pdf-lib';
import { DEFAULT_RATING_LABELS } from '@/lib/survey-types';
import type { QuestionOptions } from '@/lib/survey-types';

export const maxDuration = 30;

// NIA brand green (approximate)
const NIA_GREEN = rgb(0.18, 0.55, 0.34);
const DARK_TEXT = rgb(0.13, 0.13, 0.13);
const MUTED_TEXT = rgb(0.4, 0.4, 0.4);
const LIGHT_BG = rgb(0.96, 0.97, 0.96);
const WHITE = rgb(1, 1, 1);

const PAGE_WIDTH = 612; // US Letter
const PAGE_HEIGHT = 792;
const MARGIN = 50;
const CONTENT_WIDTH = PAGE_WIDTH - 2 * MARGIN;

interface QuestionRow {
  id: number;
  question_text: string;
  question_type: string;
  sort_order: number;
  rating_scale_max: number;
  options: QuestionOptions;
  is_required: boolean;
  help_text: string | null;
  section_label: string | null;
}

// Cursor tracks our vertical drawing position
interface Cursor {
  y: number;
  page: PDFPage;
  pageIndex: number;
}

// GET — generate a fillable PDF form for a survey
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createSupabaseServer();
  const { id } = await params;
  const surveyId = Number(id);

  // Fetch survey metadata + questions
  const [surveyRes, questionsRes] = await Promise.all([
    supabase
      .from('surveys')
      .select('title, description, welcome_message')
      .eq('id', surveyId)
      .single(),
    supabase
      .from('survey_questions')
      .select(
        'id, question_text, question_type, sort_order, rating_scale_max, options, is_required, help_text, section_label'
      )
      .eq('survey_id', surveyId)
      .order('sort_order'),
  ]);

  if (!surveyRes.data || !questionsRes.data) {
    console.error('Fillable PDF: survey not found', {
      surveyId,
      surveyError: surveyRes.error,
      questionsError: questionsRes.error,
    });
    return new Response(
      JSON.stringify({
        error: 'Survey not found',
        surveyError: surveyRes.error?.message,
        questionsError: questionsRes.error?.message,
      }),
      { status: 404 }
    );
  }

  const survey = surveyRes.data;
  const questions = questionsRes.data as QuestionRow[];

  try {
    const pdfDoc = await PDFDocument.create();
    pdfDoc.setTitle(survey.title);
    pdfDoc.setSubject('Fillable survey form');
    pdfDoc.setProducer('NIA Excellence Hub');

    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const fontItalic = await pdfDoc.embedFont(StandardFonts.HelveticaOblique);

    const form = pdfDoc.getForm();

    // --- Helper: add a new page ---
    function addPage(): PDFPage {
      return pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    }

    // --- Helper: ensure space, add page if needed ---
    function ensureSpace(cursor: Cursor, needed: number): Cursor {
      if (cursor.y - needed < MARGIN) {
        const newPage = addPage();
        cursor.page = newPage;
        cursor.pageIndex++;
        cursor.y = PAGE_HEIGHT - MARGIN;
      }
      return cursor;
    }

    // --- Helper: wrap text into lines ---
    function wrapText(text: string, maxWidth: number, f: PDFFont, size: number): string[] {
      const words = text.split(' ');
      const lines: string[] = [];
      let currentLine = '';

      for (const word of words) {
        const testLine = currentLine ? `${currentLine} ${word}` : word;
        const width = f.widthOfTextAtSize(testLine, size);
        if (width > maxWidth && currentLine) {
          lines.push(currentLine);
          currentLine = word;
        } else {
          currentLine = testLine;
        }
      }
      if (currentLine) lines.push(currentLine);
      return lines.length > 0 ? lines : [''];
    }

    // --- Helper: draw wrapped text ---
    function drawWrappedText(
      cursor: Cursor,
      text: string,
      f: PDFFont,
      size: number,
      color = DARK_TEXT,
      maxWidth = CONTENT_WIDTH,
      indent = 0
    ): Cursor {
      const lines = wrapText(text, maxWidth - indent, f, size);
      const lineHeight = size * 1.4;

      for (const line of lines) {
        cursor = ensureSpace(cursor, lineHeight);
        cursor.page.drawText(line, {
          x: MARGIN + indent,
          y: cursor.y,
          size,
          font: f,
          color,
        });
        cursor.y -= lineHeight;
      }
      return cursor;
    }

    // --- Start first page ---
    let cursor: Cursor = {
      page: addPage(),
      y: PAGE_HEIGHT - MARGIN,
      pageIndex: 0,
    };

    // --- Title block with green accent bar ---
    cursor.page.drawRectangle({
      x: MARGIN,
      y: cursor.y - 4,
      width: 4,
      height: 28,
      color: NIA_GREEN,
    });

    cursor.page.drawText(survey.title, {
      x: MARGIN + 14,
      y: cursor.y,
      size: 18,
      font: fontBold,
      color: DARK_TEXT,
    });
    cursor.y -= 32;

    // Description
    if (survey.description) {
      cursor = drawWrappedText(cursor, survey.description, font, 10, MUTED_TEXT);
      cursor.y -= 6;
    }

    // Welcome message
    if (survey.welcome_message) {
      cursor = ensureSpace(cursor, 40);
      cursor.page.drawRectangle({
        x: MARGIN,
        y: cursor.y - 24,
        width: CONTENT_WIDTH,
        height: 34,
        color: LIGHT_BG,
        borderColor: NIA_GREEN,
        borderWidth: 0.5,
      });
      const wmLines = wrapText(survey.welcome_message, CONTENT_WIDTH - 20, fontItalic, 9);
      cursor.page.drawText(wmLines[0], {
        x: MARGIN + 10,
        y: cursor.y - 2,
        size: 9,
        font: fontItalic,
        color: MUTED_TEXT,
      });
      cursor.y -= 40;
    }

    // Instructions
    cursor.y -= 4;
    cursor = drawWrappedText(
      cursor,
      'Please complete all questions below. Required questions are marked with an asterisk (*).',
      fontItalic,
      9,
      MUTED_TEXT
    );
    cursor.y -= 6;

    // Divider
    cursor.page.drawLine({
      start: { x: MARGIN, y: cursor.y },
      end: { x: PAGE_WIDTH - MARGIN, y: cursor.y },
      thickness: 0.5,
      color: rgb(0.85, 0.85, 0.85),
    });
    cursor.y -= 16;

    // --- Render each question ---
    for (let qi = 0; qi < questions.length; qi++) {
      const q = questions[qi];
      const fieldPrefix = `q${qi}`;

      // Section label
      if (q.section_label) {
        cursor = ensureSpace(cursor, 30);
        cursor.page.drawText(q.section_label, {
          x: MARGIN,
          y: cursor.y,
          size: 12,
          font: fontBold,
          color: NIA_GREEN,
        });
        cursor.y -= 20;
      }

      // Estimate space needed for question header
      cursor = ensureSpace(cursor, 50);

      // Question number + text
      const reqMark = q.is_required ? ' *' : '';
      const qLabel = `${qi + 1}. ${q.question_text}${reqMark}`;
      cursor = drawWrappedText(cursor, qLabel, fontBold, 10, DARK_TEXT);

      // Help text
      if (q.help_text) {
        cursor = drawWrappedText(cursor, q.help_text, fontItalic, 8, MUTED_TEXT, CONTENT_WIDTH, 4);
      }

      cursor.y -= 4;

      // --- Render form fields by question type ---
      switch (q.question_type) {
        case 'rating': {
          const max = q.rating_scale_max || 5;
          const labels = (q.options as QuestionOptions)?.labels || DEFAULT_RATING_LABELS[max] || [];
          const radioGroup = form.createRadioGroup(fieldPrefix);

          // Calculate layout for rating options
          const optionHeight = 16;
          const totalHeight = max * optionHeight + 4;
          cursor = ensureSpace(cursor, totalHeight);

          for (let i = 0; i < max; i++) {
            const label = labels[i] || `${i + 1}`;
            cursor = ensureSpace(cursor, optionHeight);

            // Draw radio circle
            radioGroup.addOptionToPage(`${i + 1}`, cursor.page, {
              x: MARGIN + 12,
              y: cursor.y - 2,
              width: 12,
              height: 12,
            });

            // Draw label
            cursor.page.drawText(`${i + 1} — ${label}`, {
              x: MARGIN + 30,
              y: cursor.y,
              size: 9,
              font: font,
              color: DARK_TEXT,
            });

            cursor.y -= optionHeight;
          }
          cursor.y -= 4;
          break;
        }

        case 'yes_no': {
          const radioGroup = form.createRadioGroup(fieldPrefix);
          cursor = ensureSpace(cursor, 36);

          radioGroup.addOptionToPage('yes', cursor.page, {
            x: MARGIN + 12,
            y: cursor.y - 2,
            width: 12,
            height: 12,
          });
          cursor.page.drawText('Yes', {
            x: MARGIN + 30,
            y: cursor.y,
            size: 9,
            font: font,
            color: DARK_TEXT,
          });

          cursor.y -= 16;

          radioGroup.addOptionToPage('no', cursor.page, {
            x: MARGIN + 12,
            y: cursor.y - 2,
            width: 12,
            height: 12,
          });
          cursor.page.drawText('No', {
            x: MARGIN + 30,
            y: cursor.y,
            size: 9,
            font: font,
            color: DARK_TEXT,
          });
          cursor.y -= 20;
          break;
        }

        case 'nps': {
          // NPS: 0–10 scale, laid out horizontally
          cursor = ensureSpace(cursor, 50);

          // Labels row
          cursor.page.drawText('Not at all likely', {
            x: MARGIN + 12,
            y: cursor.y,
            size: 7,
            font: fontItalic,
            color: MUTED_TEXT,
          });
          cursor.page.drawText('Extremely likely', {
            x: MARGIN + CONTENT_WIDTH - 90,
            y: cursor.y,
            size: 7,
            font: fontItalic,
            color: MUTED_TEXT,
          });
          cursor.y -= 14;

          const radioGroup = form.createRadioGroup(fieldPrefix);
          const npsCount = 11; // 0-10
          const boxSize = 14;
          const spacing = (CONTENT_WIDTH - 24) / npsCount;

          // Number labels
          for (let i = 0; i < npsCount; i++) {
            const x = MARGIN + 12 + i * spacing;
            cursor.page.drawText(`${i}`, {
              x: x + 3,
              y: cursor.y,
              size: 8,
              font: font,
              color: DARK_TEXT,
            });
          }
          cursor.y -= 16;

          // Radio buttons
          cursor = ensureSpace(cursor, boxSize + 8);
          for (let i = 0; i < npsCount; i++) {
            const x = MARGIN + 12 + i * spacing;
            radioGroup.addOptionToPage(`${i}`, cursor.page, {
              x,
              y: cursor.y - 2,
              width: boxSize,
              height: boxSize,
            });
          }
          cursor.y -= boxSize + 12;
          break;
        }

        case 'multiple_choice': {
          const choices = (q.options as QuestionOptions)?.choices || [];
          const allowOther = (q.options as QuestionOptions)?.allow_other;
          const radioGroup = form.createRadioGroup(fieldPrefix);
          const optionHeight = 16;

          cursor = ensureSpace(cursor, choices.length * optionHeight + 4);

          for (let i = 0; i < choices.length; i++) {
            cursor = ensureSpace(cursor, optionHeight);
            radioGroup.addOptionToPage(`choice_${i}`, cursor.page, {
              x: MARGIN + 12,
              y: cursor.y - 2,
              width: 12,
              height: 12,
            });
            cursor.page.drawText(choices[i], {
              x: MARGIN + 30,
              y: cursor.y,
              size: 9,
              font: font,
              color: DARK_TEXT,
            });
            cursor.y -= optionHeight;
          }

          // "Other" option
          if (allowOther) {
            cursor = ensureSpace(cursor, 30);
            radioGroup.addOptionToPage('other', cursor.page, {
              x: MARGIN + 12,
              y: cursor.y - 2,
              width: 12,
              height: 12,
            });
            cursor.page.drawText('Other:', {
              x: MARGIN + 30,
              y: cursor.y,
              size: 9,
              font: font,
              color: DARK_TEXT,
            });

            // Text field for "other" answer
            const otherField = form.createTextField(`${fieldPrefix}_other`);
            otherField.addToPage(cursor.page, {
              x: MARGIN + 72,
              y: cursor.y - 4,
              width: CONTENT_WIDTH - 84,
              height: 16,
              borderWidth: 0.5,
              borderColor: rgb(0.8, 0.8, 0.8),
            });
            cursor.y -= 20;
          }
          cursor.y -= 4;
          break;
        }

        case 'checkbox': {
          const choices = (q.options as QuestionOptions)?.choices || [];
          const allowOther = (q.options as QuestionOptions)?.allow_other;
          const optionHeight = 16;

          cursor = ensureSpace(cursor, choices.length * optionHeight + 4);

          for (let i = 0; i < choices.length; i++) {
            cursor = ensureSpace(cursor, optionHeight);
            const checkbox = form.createCheckBox(`${fieldPrefix}_cb${i}`);
            checkbox.addToPage(cursor.page, {
              x: MARGIN + 12,
              y: cursor.y - 2,
              width: 12,
              height: 12,
            });
            cursor.page.drawText(choices[i], {
              x: MARGIN + 30,
              y: cursor.y,
              size: 9,
              font: font,
              color: DARK_TEXT,
            });
            cursor.y -= optionHeight;
          }

          if (allowOther) {
            cursor = ensureSpace(cursor, 30);
            const otherCb = form.createCheckBox(`${fieldPrefix}_cb_other`);
            otherCb.addToPage(cursor.page, {
              x: MARGIN + 12,
              y: cursor.y - 2,
              width: 12,
              height: 12,
            });
            cursor.page.drawText('Other:', {
              x: MARGIN + 30,
              y: cursor.y,
              size: 9,
              font: font,
              color: DARK_TEXT,
            });
            const otherField = form.createTextField(`${fieldPrefix}_other`);
            otherField.addToPage(cursor.page, {
              x: MARGIN + 72,
              y: cursor.y - 4,
              width: CONTENT_WIDTH - 84,
              height: 16,
              borderWidth: 0.5,
              borderColor: rgb(0.8, 0.8, 0.8),
            });
            cursor.y -= 20;
          }
          cursor.y -= 4;
          break;
        }

        case 'open_text': {
          const variant = (q.options as QuestionOptions)?.variant || 'short';
          const height = variant === 'long' ? 80 : 24;

          cursor = ensureSpace(cursor, height + 8);

          const textField = form.createTextField(fieldPrefix);
          if (variant === 'long') {
            textField.enableMultiline();
          }
          textField.addToPage(cursor.page, {
            x: MARGIN + 12,
            y: cursor.y - height + 8,
            width: CONTENT_WIDTH - 24,
            height,
            borderWidth: 0.5,
            borderColor: rgb(0.8, 0.8, 0.8),
          });
          cursor.y -= height + 8;
          break;
        }

        case 'matrix': {
          const rows = (q.options as QuestionOptions)?.rows || [];
          const columns = (q.options as QuestionOptions)?.columns || [];

          if (rows.length === 0 || columns.length === 0) break;

          // Column headers
          const labelColWidth = 160;
          const colWidth = Math.min((CONTENT_WIDTH - labelColWidth - 12) / columns.length, 60);
          const rowHeight = 20;
          const headerHeight = 30;

          cursor = ensureSpace(cursor, headerHeight + rows.length * rowHeight + 8);

          // Draw column headers
          for (let ci = 0; ci < columns.length; ci++) {
            const x = MARGIN + labelColWidth + ci * colWidth;
            const headerLines = wrapText(columns[ci], colWidth - 4, font, 7);
            for (let li = 0; li < headerLines.length; li++) {
              cursor.page.drawText(headerLines[li], {
                x: x + 2,
                y: cursor.y - li * 9,
                size: 7,
                font: fontBold,
                color: MUTED_TEXT,
              });
            }
          }
          cursor.y -= headerHeight;

          // Draw rows
          for (let ri = 0; ri < rows.length; ri++) {
            cursor = ensureSpace(cursor, rowHeight);

            // Alternate row background
            if (ri % 2 === 0) {
              cursor.page.drawRectangle({
                x: MARGIN,
                y: cursor.y - 6,
                width: CONTENT_WIDTH,
                height: rowHeight,
                color: LIGHT_BG,
              });
            }

            // Row label (truncate if too long)
            const rowLabel = rows[ri].length > 30 ? rows[ri].substring(0, 28) + '...' : rows[ri];
            cursor.page.drawText(rowLabel, {
              x: MARGIN + 4,
              y: cursor.y,
              size: 8,
              font: font,
              color: DARK_TEXT,
            });

            // Radio buttons for each column
            const radioGroup = form.createRadioGroup(`${fieldPrefix}_r${ri}`);
            for (let ci = 0; ci < columns.length; ci++) {
              const x = MARGIN + labelColWidth + ci * colWidth + colWidth / 2 - 6;
              radioGroup.addOptionToPage(`c${ci}`, cursor.page, {
                x,
                y: cursor.y - 3,
                width: 12,
                height: 12,
              });
            }
            cursor.y -= rowHeight;
          }
          cursor.y -= 8;
          break;
        }
      }

      // Spacer between questions
      cursor.y -= 10;

      // Subtle divider between questions
      if (qi < questions.length - 1) {
        cursor = ensureSpace(cursor, 8);
        cursor.page.drawLine({
          start: { x: MARGIN + 12, y: cursor.y + 4 },
          end: { x: MARGIN + 200, y: cursor.y + 4 },
          thickness: 0.3,
          color: rgb(0.88, 0.88, 0.88),
        });
        cursor.y -= 8;
      }
    }

    // --- Optional email field at the bottom ---
    cursor = ensureSpace(cursor, 50);
    cursor.y -= 8;
    cursor.page.drawLine({
      start: { x: MARGIN, y: cursor.y + 4 },
      end: { x: PAGE_WIDTH - MARGIN, y: cursor.y + 4 },
      thickness: 0.5,
      color: rgb(0.85, 0.85, 0.85),
    });
    cursor.y -= 12;

    cursor.page.drawText('Email (optional — for follow-up):', {
      x: MARGIN,
      y: cursor.y,
      size: 9,
      font: font,
      color: MUTED_TEXT,
    });
    cursor.y -= 4;
    const emailField = form.createTextField('respondent_email');
    emailField.addToPage(cursor.page, {
      x: MARGIN,
      y: cursor.y - 18,
      width: 250,
      height: 20,
      borderWidth: 0.5,
      borderColor: rgb(0.8, 0.8, 0.8),
    });
    cursor.y -= 32;

    // Footer note
    cursor = ensureSpace(cursor, 20);
    cursor.page.drawText(
      'Please save this PDF after completing it and return it to the survey administrator.',
      {
        x: MARGIN,
        y: cursor.y,
        size: 8,
        font: fontItalic,
        color: MUTED_TEXT,
      }
    );

    // --- Page numbers ---
    const totalPages = pdfDoc.getPageCount();
    const pages = pdfDoc.getPages();
    for (let i = 0; i < totalPages; i++) {
      pages[i].drawText(`Page ${i + 1} of ${totalPages}`, {
        x: PAGE_WIDTH - MARGIN - 60,
        y: 20,
        size: 7,
        font: font,
        color: MUTED_TEXT,
      });
      // NIA attribution
      pages[i].drawText('NIA Excellence Hub', {
        x: MARGIN,
        y: 20,
        size: 7,
        font: font,
        color: NIA_GREEN,
      });
    }

    // Serialize
    const pdfBytes = await pdfDoc.save();
    const buffer = Buffer.from(pdfBytes);

    const filename = `${slugify(survey.title)}-survey-form.pdf`;

    return new Response(buffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'PDF generation failed';
    console.error('Fillable PDF error:', err);
    return new Response(JSON.stringify({ error: message }), { status: 500 });
  }
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}
