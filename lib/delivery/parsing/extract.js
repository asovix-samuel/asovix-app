// Entry point: validates the file type by content (not just its name) and extracts text with locations.
import { LIMITS } from '../config.js';
import { extractDocx } from './docx.js';
import { extractPdf } from './pdf.js';
import { ExtractionError } from './sections.js';

export { ExtractionError };

export const MIME = {
  pdf: 'application/pdf',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
};

/** Decides the type from the file's bytes. Returns null for anything that is not a PDF or DOCX. */
export function sniffKind(bytes, filename) {
  const head = Buffer.from(bytes.slice(0, 5)).toString('latin1');
  const name = String(filename || '').toLowerCase();
  if (head.startsWith('%PDF-') && name.endsWith('.pdf')) return 'pdf';
  if (head.startsWith('PK\x03\x04') && name.endsWith('.docx')) return 'docx';
  return null;
}

export const totalChars = (doc) => doc.segments.reduce((n, s) => n + s.text.length, 0);

export async function extractDocument(bytes, kind, maxChars = LIMITS.maxDocChars) {
  const doc = kind === 'pdf' ? await extractPdf(bytes) : await extractDocx(bytes);
  const chars = totalChars(doc);
  if (chars < LIMITS.minUsableChars) {
    throw new ExtractionError(
      kind === 'pdf'
        ? 'Almost no text could be read. This looks like a scanned or image-only PDF. Ask the client for a text-based PDF or a Word copy.'
        : 'Almost no text could be read from this document.',
    );
  }
  if (chars > maxChars) {
    throw new ExtractionError(
      `The document is too long to analyse completely (${chars.toLocaleString('en-IE')} characters; limit ${maxChars.toLocaleString('en-IE')}). It was not cut short; check that the right file was uploaded.`,
    );
  }
  return doc;
}
