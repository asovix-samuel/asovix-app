import { ExtractionError, segmentLines } from './sections.js';

export async function extractPdf(bytes) {
  const { extractText, getDocumentProxy } = await import('unpdf');
  let pages;
  try {
    const pdf = await getDocumentProxy(new Uint8Array(bytes));
    const { text } = await extractText(pdf, { mergePages: false });
    pages = Array.isArray(text) ? text : [text];
  } catch (err) {
    const msg = err && err.message ? err.message : String(err);
    if (/password/i.test(msg)) throw new ExtractionError('The PDF is password-protected. Ask the client for an unlocked copy.');
    throw new ExtractionError(`The PDF could not be read (${msg.slice(0, 120)}). It may be corrupt.`);
  }

  const segments = [];
  const warnings = [];
  let section = null;
  pages.forEach((pageText, i) => {
    const lines = pageText.split(/\r?\n/).map((text) => ({ text }));
    const r = segmentLines(lines, i + 1, section);
    section = r.lastSection;
    if (!r.segments.length) warnings.push(`Page ${i + 1} has no readable text. It may be an image or a scan, so it was not analysed.`);
    segments.push(...r.segments);
  });
  return { segments, pageCount: pages.length, warnings };
}
