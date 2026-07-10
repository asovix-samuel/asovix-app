const fs = require('fs');
const path = require('path');
const busboy = require('busboy');
const os = require('os');

export const config = { api: { bodyParser: false } };

async function extractTextFromFile(filePath, originalName) {
  const ext = path.extname(originalName).toLowerCase();
  try {
    if (ext === '.txt') {
      return fs.readFileSync(filePath, 'utf-8');
    }
    if (ext === '.pdf') {
      const pdfParse = require('pdf-parse');
      const buffer = fs.readFileSync(filePath);
      const data = await pdfParse(buffer);
      return data.text || '';
    }
    if (ext === '.docx' || ext === '.doc') {
      const mammoth = require('mammoth');
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

  const tmpBase = path.join(os.tmpdir(), `cv_${Date.now()}`);
  let originalName = 'cv.pdf';

  try {
    await new Promise((resolve, reject) => {
      const bb = busboy({ headers: req.headers });
      bb.on('file', (name, file, info) => {
        originalName = info.filename || 'cv.pdf';
        const ext = path.extname(originalName);
        const writeStream = fs.createWriteStream(tmpBase + ext);
        file.pipe(writeStream);
        writeStream.on('finish', resolve);
        writeStream.on('error', reject);
      });
      bb.on('error', reject);
      req.pipe(bb);
    });

    const ext = path.extname(originalName);
    const fullPath = tmpBase + ext;
    const text = await extractTextFromFile(fullPath, originalName);
    try { fs.unlinkSync(fullPath); } catch {}

    res.status(200).json({ text: text.substring(0, 5800), filename: originalName });
  } catch (err) {
    console.error('Upload error:', err);
    res.status(500).json({ error: 'Could not process file' });
  }
}
