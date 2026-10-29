// ── Stage 2: branded Word documents from an approved (or draft) deliverable ──
//
// Names, employers, titles, dates and education come from the verified record, never from the model.
// Rendering is deterministic: the same content always produces the same document, so files are
// rebuilt on demand rather than stored.
import { AlignmentType, BorderStyle, Document, LevelFormat, Packer, Paragraph, TabStopType, TextRun } from 'docx';

const NAVY = '1B3A6B';
const ACCENT = '2E6DA4';
const RULE = 'C8D6E8';
const BLACK = '1A1A1A';
const GREY = '555555';
const FONT = 'Arial';

const numbering = {
  config: [{
    reference: 'bullets',
    levels: [{ level: 0, format: LevelFormat.BULLET, text: '▪', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 420, hanging: 260 } } } }],
  }],
};
const page = { page: { size: { width: 11906, height: 16838 }, margin: { top: 850, right: 950, bottom: 850, left: 950 } } };

const run = (text, o = {}) => new TextRun({ text, font: FONT, size: o.size || 20, color: o.color || BLACK, bold: o.bold, italics: o.italics });
const para = (text, o = {}) => new Paragraph({ spacing: { before: o.before ?? 40, after: o.after ?? 40, line: o.line }, alignment: o.align, children: [run(text, o)] });
const bullet = (text) => new Paragraph({ numbering: { reference: 'bullets', level: 0 }, spacing: { before: 20, after: 20 }, children: [run(text)] });
const heading = (text) => new Paragraph({
  spacing: { before: 180, after: 60 },
  border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: RULE, space: 2 } },
  children: [new TextRun({ text: text.toUpperCase(), font: FONT, bold: true, size: 21, color: NAVY, characterSpacing: 30 })],
});
const dates = (r) => [r.start_text, r.end_text].filter(Boolean).join(' – ');
const roleOf = (record, id) => (record.roles || [])[Number(String(id).replace(/^r/, '')) - 1];

function nameBlock(ctx, subtitle) {
  const contact = [ctx.candidate.email || ctx.record?.profile?.email, ctx.record?.profile?.phone, ctx.candidate.location].filter(Boolean).join('  |  ');
  const out = [
    new Paragraph({ spacing: { after: 40 }, children: [new TextRun({ text: ctx.candidate.name, font: FONT, bold: true, size: 36, color: NAVY })] }),
  ];
  if (contact) out.push(para(contact, { size: 18, color: GREY, before: 0 }));
  if (subtitle) out.push(para(subtitle, { size: 21, color: ACCENT, bold: true, before: 60 }));
  out.push(new Paragraph({ spacing: { before: 60, after: 60 }, border: { bottom: { style: BorderStyle.SINGLE, size: 10, color: ACCENT, space: 0 } }, children: [] }));
  return out;
}

function roleHeader(role) {
  return new Paragraph({
    spacing: { before: 140, after: 30 },
    tabStops: [{ type: TabStopType.RIGHT, position: 10000 }],
    children: [
      run(role.title, { bold: true, size: 21, color: NAVY }),
      run('  |  ', { color: GREY }),
      run(role.employer, { italics: true, color: ACCENT }),
      run(`\t${dates(role)}`, { size: 18, color: GREY }),
    ],
  });
}

function cv(c, ctx) {
  const kids = [...nameBlock(ctx, c.headline)];
  kids.push(heading('Professional summary'), para(c.summary?.text || '', { line: 276 }));
  const skills = (c.key_skills || []).map((s) => s.skill).filter(Boolean);
  if (skills.length) kids.push(heading('Key skills'), para(skills.join('  |  ')));
  const roles = (c.experience || []).filter((r) => roleOf(ctx.record, r.role));
  if (roles.length) {
    kids.push(heading('Experience'));
    for (const r of roles) {
      kids.push(roleHeader(roleOf(ctx.record, r.role)));
      for (const b of r.bullets || []) if (b.text?.trim()) kids.push(bullet(b.text.trim()));
    }
  }
  const edu = ctx.record.education || [];
  if (edu.length) {
    kids.push(heading('Education'));
    for (const e of edu) {
      kids.push(new Paragraph({
        spacing: { before: 60, after: 20 },
        tabStops: [{ type: TabStopType.RIGHT, position: 10000 }],
        children: [run(e.qualification, { bold: true, color: NAVY }), run('  |  ', { color: GREY }), run(e.institution, { italics: true }), run(e.dates_text ? `\t${e.dates_text}` : '', { size: 18, color: GREY })],
      }));
    }
  }
  const certs = ctx.record.certifications || [];
  if (certs.length) {
    kids.push(heading('Certifications'));
    for (const x of certs) kids.push(bullet(`${x.name}${x.date_text ? ` (${x.date_text})` : ''}`));
  }
  return kids;
}

function linkedin(c, ctx) {
  const kids = [
    new Paragraph({ spacing: { after: 40 }, children: [new TextRun({ text: `LinkedIn profile: ${ctx.candidate.name}`, font: FONT, bold: true, size: 32, color: NAVY })] }),
    para('Copy each section into the matching place on your LinkedIn profile.', { color: GREY, size: 18 }),
    heading('Headline'), para(c.headline || ''),
    heading('About'),
    ...String(c.about?.text || '').split(/\n\s*\n/).map((p) => para(p.trim(), { after: 100, line: 276 })),
  ];
  const roles = (c.experience || []).filter((r) => roleOf(ctx.record, r.role));
  if (roles.length) {
    kids.push(heading('Experience descriptions'));
    for (const r of roles) {
      kids.push(roleHeader(roleOf(ctx.record, r.role)));
      for (const p of String(r.description?.text || '').split(/\n+/)) if (p.trim()) kids.push(para(p.trim()));
    }
  }
  if ((c.top_skills || []).length) kids.push(heading('Skills to pin'), ...c.top_skills.map((s) => bullet(s)));
  return kids;
}

function coverLetter(c, ctx) {
  const today = (ctx.now || new Date()).toLocaleDateString('en-IE', { day: 'numeric', month: 'long', year: 'numeric' });
  const kids = [...nameBlock(ctx, null), para(today, { color: GREY, before: 120, after: 160 })];
  if (c.company) kids.push(para(c.company, { bold: true, after: 20 }));
  if (c.role_title) kids.push(para(`Re: ${c.role_title}`, { after: 200 }));
  kids.push(para(c.greeting || 'Dear Hiring Manager,', { after: 160 }));
  for (const p of c.paragraphs || []) if (p.text?.trim()) kids.push(para(p.text.trim(), { after: 160, line: 288 }));
  kids.push(para(c.sign_off || 'Kind regards,', { before: 120 }), para(ctx.candidate.name, { bold: true, before: 200 }));
  return kids;
}

function interviewPack(c, ctx) {
  const kids = [
    new Paragraph({ spacing: { after: 40 }, children: [new TextRun({ text: `Interview prep brief: ${ctx.candidate.name}`, font: FONT, bold: true, size: 32, color: NAVY })] }),
    para(`Target: ${ctx.candidate.targetRole}. Internal brief for the mock interview; not for the client.`, { color: GREY, size: 18 }),
    heading('What the employer is hiring to solve'), para(c.role_focus || ''),
    heading('Likely questions'),
  ];
  for (const [i, q] of (c.likely_questions || []).entries()) {
    kids.push(para(`${i + 1}. ${q.question}`, { bold: true, color: NAVY, before: 120 }));
    kids.push(para(`Why they ask: ${q.why_they_ask}`, { italics: true, color: GREY, size: 18 }));
    kids.push(para(q.answer_outline?.text || ''));
  }
  kids.push(heading('STAR stories'));
  for (const s of c.stories || []) {
    kids.push(para(s.title, { bold: true, color: NAVY, before: 120 }));
    kids.push(bullet(`Situation / task: ${s.situation_task?.text || ''}`), bullet(`Action / result: ${s.action_result?.text || ''}`));
  }
  if ((c.risks || []).length) {
    kids.push(heading('Concerns to prepare for'));
    for (const r of c.risks) kids.push(bullet(`${r.concern}: ${r.how_to_address}`));
  }
  return kids;
}

const BUILDERS = { cv, linkedin, cover_letter: coverLetter, interview_pack: interviewPack };
const FILE_PART = { cv: 'CV', linkedin: 'LinkedIn-Profile', cover_letter: 'Cover-Letter', interview_pack: 'Interview-Prep-Brief' };

export function fileNameFor(kind, candidateName) {
  const n = String(candidateName || 'Client').normalize('NFKD').replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '-') || 'Client';
  return `${n}-${FILE_PART[kind]}.docx`;
}

/** ctx: { candidate: { name, email, location, targetRole }, record, now? } */
export async function renderDocx(kind, content, ctx) {
  const doc = new Document({
    creator: 'Asovix',
    title: `${ctx.candidate.name} ${FILE_PART[kind].replace(/-/g, ' ')}`,
    numbering,
    styles: { default: { document: { run: { font: FONT, size: 20, color: BLACK } } } },
    sections: [{ properties: page, children: BUILDERS[kind](content || {}, { ...ctx, record: ctx.record || {} }) }],
  });
  return Packer.toBuffer(doc);
}
