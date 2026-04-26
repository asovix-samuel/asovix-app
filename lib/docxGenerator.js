import {
  Document, Packer, Paragraph, TextRun, AlignmentType,
  LevelFormat, BorderStyle, TabStopType, HeadingLevel
} from 'docx';

const NAVY   = "1B3A6B";
const ACCENT = "2E6DA4";
const RULE   = "C8D6E8";
const BLACK  = "1A1A1A";
const GREY   = "555555";

const numberingConfig = {
  config: [{
    reference: "cv-bullets",
    levels: [{
      level: 0,
      format: LevelFormat.BULLET,
      text: "▪",
      alignment: AlignmentType.LEFT,
      style: { paragraph: { indent: { left: 420, hanging: 260 } } },
    }],
  }],
};

const docStyles = {
  default: { document: { run: { font: "Arial", size: 20, color: BLACK } } },
};

const pageProps = {
  size: { width: 11906, height: 16838 },
  margin: { top: 900, right: 1000, bottom: 900, left: 1000 },
};

function hRule() {
  return new Paragraph({
    spacing: { before: 60, after: 60 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 8, color: ACCENT, space: 0 } },
    children: [],
  });
}

function sectionHeading(text) {
  return new Paragraph({
    spacing: { before: 160, after: 40 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: RULE, space: 2 } },
    children: [
      new TextRun({ text: text.toUpperCase(), bold: true, size: 22, color: NAVY, font: "Arial", characterSpacing: 40 }),
    ],
  });
}

function bulletPara(text) {
  return new Paragraph({
    numbering: { reference: "cv-bullets", level: 0 },
    spacing: { before: 30, after: 30 },
    children: [new TextRun({ text, size: 20, color: BLACK, font: "Arial" })],
  });
}

function jobHeaderPara(title, org, dates) {
  return new Paragraph({
    spacing: { before: 140, after: 20 },
    tabStops: [{ type: TabStopType.RIGHT, position: 9360 }],
    children: [
      new TextRun({ text: title, bold: true, size: 22, color: NAVY, font: "Arial" }),
      new TextRun({ text: "  |  ", size: 20, color: GREY, font: "Arial" }),
      new TextRun({ text: org, size: 20, color: ACCENT, font: "Arial", italics: true }),
      new TextRun({ text: "\t" + dates, size: 18, color: GREY, font: "Arial" }),
    ],
  });
}

function plainPara(text, opts = {}) {
  return new Paragraph({
    spacing: { before: opts.before || 40, after: opts.after || 20 },
    children: [new TextRun({
      text,
      size: opts.size || 20,
      color: opts.color || BLACK,
      font: "Arial",
      italics: opts.italics || false,
      bold: opts.bold || false,
    })],
  });
}

/**
 * Parse raw CV text (returned by Claude) into structured docx paragraphs.
 * Handles sections: PROFESSIONAL SUMMARY, KEY SKILLS, PROFESSIONAL EXPERIENCE,
 * EDUCATION, LICENCES & CREDENTIALS, ADDITIONAL
 */
function parseCVTextToDocx(cvText, candidateName) {
  const lines = cvText.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  const children = [];

  const SECTIONS = [
    'PROFESSIONAL SUMMARY',
    'KEY SKILLS',
    'PROFESSIONAL EXPERIENCE',
    'EDUCATION',
    'LICENCES & CREDENTIALS',
    'ADDITIONAL',
    'CERTIFICATIONS',
    'EXTRACURRICULAR',
  ];

  let nameFound = false;
  let subtitleFound = false;
  let contactFound = false;
  let currentSection = null;
  let inExperience = false;
  let pendingJobTitle = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const upper = line.toUpperCase();

    // ── Name block (first 3 lines) ──
    if (!nameFound) {
      children.push(new Paragraph({
        spacing: { before: 0, after: 20 },
        children: [new TextRun({ text: line, bold: true, size: 52, color: NAVY, font: "Arial" })],
      }));
      nameFound = true;
      continue;
    }

    if (!subtitleFound && nameFound && !contactFound) {
      // Second line could be subtitle or contact
      const isContact = line.includes('@') || line.includes('+') || line.includes('|');
      if (isContact) {
        children.push(new Paragraph({
          spacing: { before: 0, after: 20 },
          children: [new TextRun({ text: line, size: 18, color: GREY, font: "Arial" })],
        }));
        contactFound = true;
        subtitleFound = true;
      } else {
        children.push(new Paragraph({
          spacing: { before: 0, after: 60 },
          children: [new TextRun({ text: line, size: 20, color: ACCENT, font: "Arial", italics: true })],
        }));
        subtitleFound = true;
      }
      continue;
    }

    if (subtitleFound && !contactFound && (line.includes('@') || line.includes('+353') || line.includes('+44') || line.includes('linkedin'))) {
      children.push(new Paragraph({
        spacing: { before: 0, after: 20 },
        children: [new TextRun({ text: line, size: 18, color: GREY, font: "Arial" })],
      }));
      contactFound = true;
      children.push(hRule());
      continue;
    }

    // ── Section headings ──
    const matchedSection = SECTIONS.find(s => upper.includes(s));
    if (matchedSection) {
      currentSection = matchedSection;
      inExperience = matchedSection === 'PROFESSIONAL EXPERIENCE';
      pendingJobTitle = null;
      children.push(sectionHeading(matchedSection === 'LICENCES & CREDENTIALS' ? 'Licences & Credentials' : matchedSection.charAt(0) + matchedSection.slice(1).toLowerCase()));
      continue;
    }

    // ── Bullet points ──
    if (line.startsWith('•') || line.startsWith('▪') || line.startsWith('-') || line.startsWith('*')) {
      const bulletText = line.replace(/^[•▪\-\*]\s*/, '').trim();
      if (bulletText) children.push(bulletPara(bulletText));
      continue;
    }

    // ── Experience section: detect job headers ──
    if (inExperience && line.includes('|')) {
      const parts = line.split('|').map(p => p.trim());
      if (parts.length >= 2) {
        const title = parts[0] || '';
        const org = parts[1] || '';
        const dates = parts[2] || '';
        children.push(jobHeaderPara(title, org, dates));
        continue;
      }
    }

    // ── Education entries ──
    if (currentSection && currentSection.includes('EDUCATION') && line.includes('|')) {
      const parts = line.split('|').map(p => p.trim());
      children.push(new Paragraph({
        spacing: { before: 120, after: 20 },
        children: [
          new TextRun({ text: parts[0] || '', bold: true, size: 22, color: NAVY, font: "Arial" }),
          new TextRun({ text: parts[1] ? '  |  ' + parts[1] : '', size: 20, color: ACCENT, font: "Arial", italics: true }),
          new TextRun({ text: parts[2] ? '  |  ' + parts[2] : '', size: 18, color: GREY, font: "Arial" }),
        ],
      }));
      continue;
    }

    // ── Key skills lines ──
    if (currentSection === 'KEY SKILLS') {
      children.push(new Paragraph({
        spacing: { before: 0, after: 40 },
        children: [new TextRun({ text: line, size: 20, color: BLACK, font: "Arial" })],
      }));
      continue;
    }

    // ── Licence / note lines ──
    if (currentSection && (currentSection.includes('LICENCES') || currentSection.includes('CERTIF'))) {
      const isBold = !line.startsWith('Cover') && !line.startsWith('Progressing') && line.length > 10;
      children.push(new Paragraph({
        spacing: { before: isBold ? 80 : 0, after: 20 },
        children: [new TextRun({ text: line, bold: isBold, size: 20, color: isBold ? BLACK : GREY, font: "Arial", italics: !isBold })],
      }));
      continue;
    }

    // ── Summary and everything else ──
    if (line.length > 0) {
      children.push(plainPara(line, {
        before: currentSection === 'PROFESSIONAL SUMMARY' ? 40 : 30,
        color: currentSection === 'PROFESSIONAL SUMMARY' ? BLACK : GREY,
        italics: currentSection && currentSection.includes('EDUCATION') && line.startsWith('Key'),
      }));
    }
  }

  return new Document({
    numbering: numberingConfig,
    styles: docStyles,
    sections: [{ properties: { page: pageProps }, children }],
  });
}

/**
 * Generate all 3 CV buffers from raw Claude output text
 */
export async function generateDocxBuffers(claudeOutput) {
  const parts = claudeOutput.split(/===CV[123]===/);
  // parts[0] is before first marker (empty or preamble)
  const cv1Text = (parts[1] || '').trim();
  const cv2Text = (parts[2] || '').trim();
  const cv3Text = (parts[3] || '').trim();

  const [buf1, buf2, buf3] = await Promise.all([
    Packer.toBuffer(parseCVTextToDocx(cv1Text, 'CV1')),
    Packer.toBuffer(parseCVTextToDocx(cv2Text, 'CV2')),
    Packer.toBuffer(parseCVTextToDocx(cv3Text, 'CV3')),
  ]);

  return { buf1, buf2, buf3, cv1Text, cv2Text, cv3Text };
}
