import { IncomingForm } from 'formidable';
import fs from 'fs';
import path from 'path';

export const config = { api: { bodyParser: false } };

async function extractTextFromFile(filePath, mimeType, originalName) {
  const ext = path.extname(originalName).toLowerCase();

  try {
    if (ext === '.txt') {
      return fs.readFileSync(filePath, 'utf-8');
    }

    if (ext === '.pdf') {
      const pdfParse = (await import('pdf-parse')).default;
      const buffer = fs.readFileSync(filePath);
      const data = await pdfParse(buffer);
      return data.text || '';
    }

    if (ext === '.docx' || ext === '.doc') {
      const mammoth = (await import('mammoth')).default;
      const result = await mammoth.extractRawText({ path: filePath });
      return result.value || '';
    }

    return '';
  } catch (err) {
    console.error('Text extraction error:', err);
    return '';
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const form = new IncomingForm({
    maxFileSize: 5 * 1024 * 1024, // 5MB
    keepExtensions: true,
  });

  form.parse(req, async (err, fields, files) => {
    if (err) {
      return res.status(400).json({ error: 'File upload failed' });
    }

    const file = files.cv?.[0] || files.cv;
    if (!file) {
      return res.status(400).json({ error: 'No file received' });
    }

    const filePath = file.filepath || file.path;
    const originalName = file.originalFilename || file.name || 'cv.pdf';

    try {
      const text = await extractTextFromFile(filePath, file.mimetype, originalName);

      // Clean up temp file
      try { fs.unlinkSync(filePath); } catch {}

      res.status(200).json({
        text: text.substring(0, 6000), // Cap at 6000 chars for Claude context
        filename: originalName,
      });
    } catch (err) {
      res.status(500).json({ error: 'Could not extract text from file' });
    }
  });
}
