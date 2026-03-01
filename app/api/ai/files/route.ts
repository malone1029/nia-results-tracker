import { createSupabaseServer } from '@/lib/supabase-server';

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

// Map MIME types and file extensions to our type labels
const ACCEPTED_EXTENSIONS = [
  '.txt',
  '.md',
  '.csv',
  '.json',
  '.png',
  '.jpg',
  '.jpeg',
  '.pdf',
  '.xlsx',
  '.xls',
  '.docx',
];

function getFileExtension(fileName: string): string {
  const ext = fileName.toLowerCase().split('.').pop() || '';
  return ext;
}

async function extractTextFromPdf(buffer: ArrayBuffer): Promise<string> {
  const { PDFParse } = await import('pdf-parse');
  const pdf = new PDFParse({ data: new Uint8Array(buffer) });
  const result = await pdf.getText();
  return result.text;
}

async function extractTextFromDocx(buffer: ArrayBuffer): Promise<string> {
  const mammoth = await import('mammoth');
  const result = await mammoth.extractRawText({ buffer: Buffer.from(buffer) });
  return result.value;
}

async function extractTextFromXlsx(buffer: ArrayBuffer): Promise<string> {
  const ExcelJS = (await import('exceljs')).default;
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);

  const lines: string[] = [];
  workbook.eachSheet((worksheet) => {
    lines.push(`## Sheet: ${worksheet.name}`);
    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber <= 50) {
        // Limit to first 50 rows per sheet
        const values = (row.values as (string | number | null)[])
          .slice(1) // ExcelJS row.values is 1-indexed
          .map((v) => (v !== null && v !== undefined ? String(v) : ''))
          .join(' | ');
        lines.push(values);
      }
    });
    if (worksheet.rowCount > 50) {
      lines.push(`\n[...${worksheet.rowCount - 50} more rows not shown]`);
    }
    lines.push('');
  });

  return lines.join('\n');
}

// GET: List files for a process
export async function GET(request: Request) {
  const supabase = await createSupabaseServer();
  const { searchParams } = new URL(request.url);
  const processId = searchParams.get('processId');

  if (!processId) {
    return Response.json({ error: 'processId is required' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('process_files')
    .select('id, file_name, file_type, file_size, uploaded_at')
    .eq('process_id', processId)
    .order('uploaded_at', { ascending: false });

  if (error) {
    return Response.json({ error: 'Failed to fetch files' }, { status: 500 });
  }

  return Response.json(data);
}

// POST: Upload a file
export async function POST(request: Request) {
  const supabase = await createSupabaseServer();
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const processId = formData.get('processId') as string | null;

    if (!file || !processId) {
      return Response.json({ error: 'file and processId are required' }, { status: 400 });
    }

    if (file.size > MAX_FILE_SIZE) {
      return Response.json({ error: 'File too large. Maximum size is 10MB.' }, { status: 400 });
    }

    const ext = getFileExtension(file.name);
    if (!ACCEPTED_EXTENSIONS.includes(`.${ext}`)) {
      return Response.json(
        { error: `File type ".${ext}" not supported. Accepted: ${ACCEPTED_EXTENSIONS.join(', ')}` },
        { status: 400 }
      );
    }

    let content: string;
    const isImage = file.type.startsWith('image/') || ['png', 'jpg', 'jpeg'].includes(ext);

    if (isImage) {
      // Store images as base64 data URLs
      const buffer = await file.arrayBuffer();
      const base64 = Buffer.from(buffer).toString('base64');
      const mimeType = file.type || `image/${ext === 'jpg' ? 'jpeg' : ext}`;
      content = `data:${mimeType};base64,${base64}`;
    } else if (ext === 'pdf') {
      const buffer = await file.arrayBuffer();
      content = await extractTextFromPdf(buffer);
    } else if (ext === 'docx') {
      const buffer = await file.arrayBuffer();
      content = await extractTextFromDocx(buffer);
    } else if (ext === 'xlsx' || ext === 'xls') {
      const buffer = await file.arrayBuffer();
      content = await extractTextFromXlsx(buffer);
    } else {
      // Text-based files (txt, md, csv, json)
      content = await file.text();
    }

    const { data, error } = await supabase
      .from('process_files')
      .insert({
        process_id: parseInt(processId),
        file_name: file.name,
        file_type: ext,
        file_size: file.size,
        content,
      })
      .select('id, file_name, file_type, file_size, uploaded_at')
      .single();

    if (error) {
      console.error('File upload error:', error);
      return Response.json({ error: 'Failed to save file' }, { status: 500 });
    }

    return Response.json(data);
  } catch (error) {
    console.error('Upload error:', error);
    return Response.json({ error: 'Upload failed' }, { status: 500 });
  }
}

// DELETE: Remove a file
export async function DELETE(request: Request) {
  const supabase = await createSupabaseServer();
  const { searchParams } = new URL(request.url);
  const fileId = searchParams.get('fileId');

  if (!fileId) {
    return Response.json({ error: 'fileId is required' }, { status: 400 });
  }

  const { error } = await supabase.from('process_files').delete().eq('id', fileId);

  if (error) {
    return Response.json({ error: 'Failed to delete file' }, { status: 500 });
  }

  return Response.json({ success: true });
}
