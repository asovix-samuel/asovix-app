// Reads a .docx directly from its XML so nothing is silently dropped:
// body paragraphs, tables (row by row), text boxes, headers, footers, footnotes and endnotes.
import { ExtractionError, segmentLines } from './sections.js';

const tagOf = (n) => Object.keys(n).find((k) => k !== ':@' && k !== '#text');
const kids = (n) => {
  const t = tagOf(n);
  return t && Array.isArray(n[t]) ? n[t] : [];
};

/** Text of an inline subtree. Text boxes found inside are pushed to `boxes` rather than inlined. */
function inlineText(nodes, boxes) {
  let out = '';
  for (const n of nodes) {
    if ('#text' in n) continue;
    const tag = tagOf(n);
    if (!tag) continue;
    switch (tag) {
      case 'w:t':
        for (const c of kids(n)) if ('#text' in c) out += String(c['#text']);
        break;
      case 'w:tab': out += '\t'; break;
      case 'w:br':
      case 'w:cr': out += '\n'; break;
      case 'w:instrText':
      case 'w:delText':
      case 'w:pPr':
      case 'w:rPr':
      case 'mc:Fallback': // duplicate of mc:Choice
        break;
      case 'w:txbxContent': boxes.push(kids(n)); break;
      default: out += inlineText(kids(n), boxes);
    }
  }
  return out;
}

function pStyle(p) {
  const pPr = kids(p).find((c) => tagOf(c) === 'w:pPr');
  const st = pPr && kids(pPr).find((c) => tagOf(c) === 'w:pStyle');
  return (st && st[':@'] && st[':@']['@_w:val']) || '';
}

function emitBlocks(nodes, out) {
  for (const n of nodes) {
    const tag = tagOf(n);
    if (tag === 'w:p') {
      const boxes = [];
      const text = inlineText(kids(n), boxes).replace(/[ \t]+\n/g, '\n');
      const isHeading = /^(heading\d|title)/i.test(pStyle(n));
      for (const line of text.split('\n')) if (line.trim()) out.push({ text: line.trim(), heading: isHeading });
      for (const box of boxes) {
        const inner = [];
        emitBlocks(box, inner);
        for (const l of inner) out.push({ text: l.text });
      }
    } else if (tag === 'w:tbl') {
      for (const row of kids(n).filter((c) => tagOf(c) === 'w:tr')) {
        const cells = [];
        for (const cell of kids(row).filter((c) => tagOf(c) === 'w:tc')) {
          const inner = [];
          emitBlocks(kids(cell), inner);
          cells.push(inner.map((l) => l.text).join(' / '));
        }
        const line = cells.filter((c) => c.trim()).join(' | ');
        if (line.trim()) out.push({ text: line });
      }
    } else if (tag === 'w:sdt') {
      const content = kids(n).find((c) => tagOf(c) === 'w:sdtContent');
      if (content) emitBlocks(kids(content), out);
    } else if (tag && tag !== 'w:sectPr') {
      emitBlocks(kids(n), out);
    }
  }
}

export async function extractDocx(bytes) {
  const { default: JSZip } = await import('jszip');
  const { XMLParser } = await import('fast-xml-parser');
  const parser = new XMLParser({ preserveOrder: true, ignoreAttributes: false, attributeNamePrefix: '@_', trimValues: false, parseTagValue: false, processEntities: true });
  const linesOfXml = (xml) => {
    const out = [];
    emitBlocks(parser.parse(xml), out);
    return out;
  };

  let zip;
  try {
    zip = await JSZip.loadAsync(bytes);
  } catch (e) {
    throw new ExtractionError('The DOCX could not be opened. It may be corrupt or not a real Word document.');
  }
  const main = zip.file('word/document.xml');
  if (!main) throw new ExtractionError('This file is not a Word (.docx) document.');

  const mainXml = await main.async('string');
  const segments = [];
  const warnings = [];
  segments.push(...segmentLines(linesOfXml(mainXml), null, null).segments);

  const extras = [
    [/^word\/header\d*\.xml$/, 'Header'],
    [/^word\/footer\d*\.xml$/, 'Footer'],
    [/^word\/footnotes\.xml$/, 'Footnotes'],
    [/^word\/endnotes\.xml$/, 'Endnotes'],
  ];
  const seen = new Set();
  for (const name of Object.keys(zip.files).sort()) {
    for (const [re, label] of extras) {
      if (!re.test(name)) continue;
      const xml = await zip.file(name).async('string');
      const text = linesOfXml(xml).map((l) => l.text).join('\n').trim();
      if (text && !seen.has(label + text)) {
        seen.add(label + text);
        segments.push({ page: null, section: label, text });
      }
    }
  }

  const imageCount = (mainXml.match(/<pic:pic[\s>]|<v:imagedata[\s>]/g) || []).length;
  if (imageCount) warnings.push(`The document contains ${imageCount} image(s). Text inside images (for example a pasted screenshot or scan) cannot be read and was not analysed.`);

  return { segments, pageCount: null, warnings };
}
