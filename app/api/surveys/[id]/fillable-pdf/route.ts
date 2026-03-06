import { createSupabaseServer } from '@/lib/supabase-server';
import { PDFDocument, PDFFont, StandardFonts, rgb, PDFPage } from 'pdf-lib';
import { DEFAULT_RATING_LABELS } from '@/lib/survey-types';
import type { QuestionOptions } from '@/lib/survey-types';
import { readFile } from 'fs/promises';
import { join } from 'path';

export const maxDuration = 30;

// NIA Brand Colors (from brand guidelines)
const NIA_DARK = rgb(0x32 / 255, 0x4a / 255, 0x4d / 255); // #324a4d — headers, primary
const NIA_GREY_BLUE = rgb(0x55 / 255, 0x78 / 255, 0x7c / 255); // #55787c — secondary
const NIA_ORANGE = rgb(0xf7 / 255, 0x99 / 255, 0x35 / 255); // #f79935 — accents
const NIA_GREEN = rgb(0xb1 / 255, 0xbd / 255, 0x37 / 255); // #b1bd37 — success

const DARK_TEXT = rgb(0.15, 0.15, 0.15);
const MUTED_TEXT = rgb(0.42, 0.42, 0.42);
const LIGHT_BG = rgb(0.96, 0.97, 0.97);
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

    // --- Helper: sanitize text for pdf-lib (cannot encode newlines/tabs) ---
    function sanitize(text: string): string {
      return text
        .replace(/[\n\r\t]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    }

    // --- Helper: wrap text into lines ---
    function wrapText(text: string, maxWidth: number, f: PDFFont, size: number): string[] {
      // First: split on explicit newlines, then word-wrap each paragraph
      const paragraphs = text.split(/\r?\n/);
      const lines: string[] = [];

      for (const para of paragraphs) {
        const clean = para.replace(/\t/g, ' ').replace(/\s+/g, ' ').trim();
        if (!clean) {
          lines.push('');
          continue;
        }
        const words = clean.split(' ');
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
      }
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

    // --- Embed NIA logo ---
    let logoImage: Awaited<ReturnType<typeof pdfDoc.embedPng>> | null = null;
    try {
      const logoPath = join(process.cwd(), 'public', 'logo.png');
      const logoBytes = await readFile(logoPath);
      logoImage = await pdfDoc.embedPng(logoBytes);
    } catch {
      // Logo not found — continue without it
    }

    // --- Start first page ---
    let cursor: Cursor = {
      page: addPage(),
      y: PAGE_HEIGHT - MARGIN,
      pageIndex: 0,
    };

    // --- Header banner (NIA Dark with orange accent) ---
    const titleX = logoImage ? MARGIN + 46 : MARGIN;
    const titleMaxWidth = PAGE_WIDTH - titleX - MARGIN;
    const titleClean = sanitize(survey.title);

    // Auto-size title: try sizes from 14 down to 10, pick the largest
    // that fits in 2 lines. Allow 3 lines at smallest size.
    let titleFontSize = 14;
    let titleLines = wrapText(titleClean, titleMaxWidth, fontBold, titleFontSize);
    for (const trySize of [14, 13, 12, 11, 10]) {
      titleLines = wrapText(titleClean, titleMaxWidth, fontBold, trySize);
      titleFontSize = trySize;
      if (titleLines.length <= 2) break;
    }

    const titleLineHeight = titleFontSize + 4;
    const titleTextHeight = titleLines.length * titleLineHeight;
    const headerPadding = 14;
    const headerHeight = Math.max(56, titleTextHeight + headerPadding * 2);

    cursor.page.drawRectangle({
      x: 0,
      y: PAGE_HEIGHT - headerHeight,
      width: PAGE_WIDTH,
      height: headerHeight,
      color: NIA_DARK,
    });
    // Orange accent line at bottom of header
    cursor.page.drawRectangle({
      x: 0,
      y: PAGE_HEIGHT - headerHeight - 3,
      width: PAGE_WIDTH,
      height: 3,
      color: NIA_ORANGE,
    });

    // Logo in header (vertically centered)
    if (logoImage) {
      const logoSize = Math.min(36, headerHeight - 16);
      cursor.page.drawImage(logoImage, {
        x: MARGIN,
        y: PAGE_HEIGHT - headerHeight + (headerHeight - logoSize) / 2,
        width: logoSize,
        height: logoSize,
      });
    }

    // Title text (vertically centered in header)
    const titleStartY =
      PAGE_HEIGHT -
      headerHeight +
      (headerHeight - titleTextHeight) / 2 +
      titleTextHeight -
      titleFontSize;

    for (let i = 0; i < titleLines.length; i++) {
      cursor.page.drawText(titleLines[i], {
        x: titleX,
        y: titleStartY - i * titleLineHeight,
        size: titleFontSize,
        font: fontBold,
        color: WHITE,
      });
    }

    cursor.y = PAGE_HEIGHT - headerHeight - 20;

    // Description
    if (survey.description) {
      cursor = drawWrappedText(cursor, survey.description, font, 10, MUTED_TEXT);
      cursor.y -= 6;
    }

    // Welcome message (with NIA Grey-Blue left border)
    if (survey.welcome_message) {
      const wmLines = wrapText(survey.welcome_message, CONTENT_WIDTH - 24, fontItalic, 9);
      const wmHeight = Math.max(wmLines.length * 13 + 12, 34);
      cursor = ensureSpace(cursor, wmHeight);

      cursor.page.drawRectangle({
        x: MARGIN,
        y: cursor.y - wmHeight + 14,
        width: CONTENT_WIDTH,
        height: wmHeight,
        color: LIGHT_BG,
      });
      // Left accent bar
      cursor.page.drawRectangle({
        x: MARGIN,
        y: cursor.y - wmHeight + 14,
        width: 3,
        height: wmHeight,
        color: NIA_GREY_BLUE,
      });
      for (let i = 0; i < wmLines.length; i++) {
        cursor.page.drawText(wmLines[i], {
          x: MARGIN + 12,
          y: cursor.y - i * 13,
          size: 9,
          font: fontItalic,
          color: MUTED_TEXT,
        });
      }
      cursor.y -= wmHeight + 4;
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
      color: NIA_GREY_BLUE,
      opacity: 0.3,
    });
    cursor.y -= 16;

    // --- Render each question ---
    for (let qi = 0; qi < questions.length; qi++) {
      const q = questions[qi];
      const fieldPrefix = `q${qi}`;

      // Section label
      if (q.section_label) {
        cursor = ensureSpace(cursor, 30);
        // Section divider line
        cursor.page.drawLine({
          start: { x: MARGIN, y: cursor.y + 6 },
          end: { x: MARGIN + 180, y: cursor.y + 6 },
          thickness: 1,
          color: NIA_ORANGE,
          opacity: 0.5,
        });
        cursor.page.drawText(sanitize(q.section_label), {
          x: MARGIN,
          y: cursor.y - 8,
          size: 11,
          font: fontBold,
          color: NIA_DARK,
        });
        cursor.y -= 24;
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
            cursor.page.drawText(sanitize(`${i + 1} — ${label}`), {
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
            cursor.page.drawText(sanitize(choices[i]), {
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
            otherField.setFontSize(9);
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
            cursor.page.drawText(sanitize(choices[i]), {
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
            otherField.setFontSize(9);
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
          const height = variant === 'long' ? 100 : 24;

          cursor = ensureSpace(cursor, height + 8);

          const textField = form.createTextField(fieldPrefix);
          if (variant === 'long') {
            textField.enableMultiline();
          }
          textField.setFontSize(10);
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
          const labelColWidth = 200;
          const colWidth = Math.min((CONTENT_WIDTH - labelColWidth - 12) / columns.length, 60);
          const minRowHeight = 20;
          const matrixHeaderHeight = 30;
          const matrixLabelFontSize = 7.5;
          const matrixLabelLineHeight = matrixLabelFontSize * 1.3;

          // Pre-calculate row heights (wrap labels instead of truncating)
          const rowWrappedLabels = rows.map((row) => {
            const rowText = sanitize(row);
            return wrapText(rowText, labelColWidth - 12, font, matrixLabelFontSize);
          });
          const rowHeights = rowWrappedLabels.map((lines) =>
            Math.max(minRowHeight, lines.length * matrixLabelLineHeight + 8)
          );

          const totalMatrixHeight = matrixHeaderHeight + rowHeights.reduce((a, b) => a + b, 0) + 8;
          cursor = ensureSpace(cursor, Math.min(totalMatrixHeight, 200));

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
          cursor.y -= matrixHeaderHeight;

          // Draw rows
          for (let ri = 0; ri < rows.length; ri++) {
            const thisRowHeight = rowHeights[ri];
            cursor = ensureSpace(cursor, thisRowHeight);

            // Alternate row background
            if (ri % 2 === 0) {
              cursor.page.drawRectangle({
                x: MARGIN,
                y: cursor.y - thisRowHeight + minRowHeight - 6,
                width: CONTENT_WIDTH,
                height: thisRowHeight,
                color: LIGHT_BG,
              });
            }

            // Row label (wrapped, not truncated)
            const lines = rowWrappedLabels[ri];
            for (let li = 0; li < lines.length; li++) {
              cursor.page.drawText(lines[li], {
                x: MARGIN + 4,
                y: cursor.y - li * matrixLabelLineHeight,
                size: matrixLabelFontSize,
                font: font,
                color: DARK_TEXT,
              });
            }

            // Radio buttons for each column (vertically centered in row)
            const radioGroup = form.createRadioGroup(`${fieldPrefix}_r${ri}`);
            const radioYCenter = cursor.y - (thisRowHeight - minRowHeight) / 2;
            for (let ci = 0; ci < columns.length; ci++) {
              const x = MARGIN + labelColWidth + ci * colWidth + colWidth / 2 - 6;
              radioGroup.addOptionToPage(`c${ci}`, cursor.page, {
                x,
                y: radioYCenter - 3,
                width: 12,
                height: 12,
              });
            }
            cursor.y -= thisRowHeight;
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
          color: NIA_GREY_BLUE,
          opacity: 0.2,
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
    emailField.setFontSize(10);
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

    // --- Page footer on every page ---
    const totalPages = pdfDoc.getPageCount();
    const pages = pdfDoc.getPages();
    for (let i = 0; i < totalPages; i++) {
      // Footer line
      pages[i].drawLine({
        start: { x: MARGIN, y: 32 },
        end: { x: PAGE_WIDTH - MARGIN, y: 32 },
        thickness: 0.5,
        color: NIA_GREY_BLUE,
        opacity: 0.3,
      });
      // NIA attribution
      pages[i].drawText('Northwestern Illinois Association', {
        x: MARGIN,
        y: 20,
        size: 7,
        font: fontBold,
        color: NIA_DARK,
      });
      // Page number
      pages[i].drawText(`Page ${i + 1} of ${totalPages}`, {
        x: PAGE_WIDTH - MARGIN - 55,
        y: 20,
        size: 7,
        font: font,
        color: NIA_GREY_BLUE,
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
