// ── Stage 2: PDF copies of the client documents ──
//
// The same approved content that becomes the Word file is laid out here as a plain, clean PDF
// (built-in Helvetica, no embedded fonts, so files stay small). **text** is bold.
// Names, employers, titles, dates and education come from the verified record, like the Word files.
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

const NAVY = rgb(0.106, 0.227, 0.42);
const GREY = rgb(0.33, 0.33, 0.33);
const dates = (r) => [r.start_text, r.end_text].filter(Boolean).join(' - ');
const roleOf = (record, id) => (record.roles || [])[Number(String(id).replace(/^r/, '')) - 1];

/** Helvetica can only draw Latin-1 text: map the usual typographic characters and drop the rest. */
export function clean(t) {
  return String(t ?? '')
    .replace(/[‘’‛]/g, "'").replace(/[“”„]/g, '"')
    .replace(/[–—]/g, '-').replace(/…/g, '...').replace(/[•▪●]/g, '-')
    .replace(/ /g, ' ').replace(/[^\x09\x0A\x20-\x7E¡-ÿ]/g, '');
}

/** [type, text, right?] blocks: name | line | tag | h | p | role | b | gap */
export function blocksFor(kind, c, ctx) {
  const b = [];
  const contact = [ctx.candidate.email || ctx.record?.profile?.email, ctx.record?.profile?.phone, ctx.candidate.location].filter(Boolean).join('  |  ');
  const head = (title) => { b.push(['name', title]); };
  const roles = (c.experience || []).filter((r) => roleOf(ctx.record, r.role));
  if (kind === 'cv') {
    head(ctx.candidate.name);
    if (contact) b.push(['line', contact]);
    if (c.headline) b.push(['tag', c.headline]);
    b.push(['h', 'Professional summary'], ['p', c.summary?.text || '']);
    const skills = (c.key_skills || []).map((s) => s.skill).filter(Boolean);
    if (skills.length) b.push(['h', 'Key skills'], ['p', skills.join('  |  ')]);
    if (roles.length) {
      b.push(['h', 'Experience']);
      for (const r of roles) {
        const role = roleOf(ctx.record, r.role);
        b.push(['role', `${role.title} | ${role.employer}`, dates(role)]);
        for (const x of r.bullets || []) if (x.text?.trim()) b.push(['b', x.text.trim()]);
      }
    }
    const edu = ctx.record.education || [];
    if (edu.length || (c.education_notes || []).length) {
      b.push(['h', 'Education']);
      for (const e of edu) b.push(['role', `${e.qualification} | ${e.institution}`, e.dates_text || '']);
      for (const n of c.education_notes || []) if (n.text?.trim()) b.push(['b', n.text.trim()]);
    }
    const certs = ctx.record.certifications || [];
    if (certs.length) { b.push(['h', 'Certifications']); for (const x of certs) b.push(['b', `${x.name}${x.date_text ? ` (${x.date_text})` : ''}`]); }
  } else if (kind === 'linkedin') {
    head(`LinkedIn profile: ${ctx.candidate.name}`);
    b.push(['line', 'Copy each section into the matching place on your LinkedIn profile.']);
    b.push(['h', 'Headline'], ['p', c.headline || ''], ['h', 'About']);
    for (const p of String(c.about?.text || '').split(/\n\s*\n/)) if (p.trim()) b.push(['p', p.trim()]);
    if (roles.length) {
      b.push(['h', 'Experience descriptions']);
      for (const r of roles) {
        const role = roleOf(ctx.record, r.role);
        b.push(['role', `${role.title} | ${role.employer}`, dates(role)]);
        for (const p of String(r.description?.text || '').split(/\n+/)) if (p.trim()) b.push(['p', p.trim()]);
      }
    }
    if ((c.top_skills || []).length) { b.push(['h', 'Skills to pin']); for (const s of c.top_skills) b.push(['b', s]); }
  } else if (kind === 'cover_letter') {
    head(ctx.candidate.name);
    if (contact) b.push(['line', contact]);
    b.push(['gap'], ['p', (ctx.now || new Date()).toLocaleDateString('en-IE', { day: 'numeric', month: 'long', year: 'numeric' })], ['gap']);
    if (c.company) b.push(['p', `**${c.company}**`]);
    if (c.role_title) b.push(['p', `Re: ${c.role_title}`]);
    b.push(['gap'], ['p', c.greeting || 'Dear Hiring Manager,']);
    for (const p of c.paragraphs || []) if (p.text?.trim()) b.push(['p', p.text.trim()], ['gap']);
    b.push(['p', c.sign_off || 'Kind regards,'], ['p', `**${ctx.candidate.name}**`]);
  } else if (kind === 'interview_pack') {
    head(`Interview prep brief: ${ctx.candidate.name}`);
    b.push(['h', 'What the employer is hiring to solve'], ['p', c.role_focus || ''], ['h', 'Likely questions']);
    for (const [i, q] of (c.likely_questions || []).entries()) b.push(['p', `**${i + 1}. ${q.question}**`], ['p', `Why they ask: ${q.why_they_ask}`], ['p', q.answer_outline?.text || '']);
    b.push(['h', 'STAR stories']);
    for (const s of c.stories || []) b.push(['p', `**${s.title}**`], ['b', `Situation / task: ${s.situation_task?.text || ''}`], ['b', `Action / result: ${s.action_result?.text || ''}`]);
    if ((c.risks || []).length) { b.push(['h', 'Concerns to prepare for']); for (const r of c.risks) b.push(['b', `${r.concern}: ${r.how_to_address}`]); }
  }
  return b;
}

export async function renderPdf(kind, content, ctx) {
  const blocks = blocksFor(kind, content || {}, { ...ctx, record: ctx.record || {} });
  const pdf = await PDFDocument.create();
  pdf.setTitle(clean(`${ctx.candidate.name} ${kind}`));
  pdf.setCreator('Asovix');
  const reg = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const W = 595.28, H = 841.89, M = 44;
  const SIZE = 9.8, LEAD = 12.2;
  let page = pdf.addPage([W, H]);
  let y = H - M;
  const need = (h) => { if (y - h < M) { page = pdf.addPage([W, H]); y = H - M; } };

  // words with a "glue" flag: no space before a word that directly follows a bold/regular boundary
  const toks = (t) => {
    const out = [];
    clean(t).split('**').forEach((p, i) => {
      if (!p) return;
      p.split(' ').forEach((w, j) => { if (w) out.push({ w, b: i % 2 === 1, glue: j === 0 && !p.startsWith(' ') && out.length > 0 }); });
    });
    return out;
  };
  const wrap = (t, size, width, allBold = false) => {
    const lines = []; let cur = []; let cw = 0;
    const sp = reg.widthOfTextAtSize(' ', size);
    for (const k of toks(t)) {
      const f = k.b || allBold ? bold : reg;
      const kw = f.widthOfTextAtSize(k.w, size);
      if (cur.length && !k.glue && cw + sp + kw > width) { lines.push(cur); cur = []; cw = 0; }
      cw += (cur.length && !k.glue ? sp : 0) + kw;
      cur.push({ ...k, b: k.b || allBold });
    }
    if (cur.length) lines.push(cur);
    return lines;
  };
  const draw = (line, x, size, color) => {
    const sp = reg.widthOfTextAtSize(' ', size);
    let cx = x;
    line.forEach((k, i) => {
      const f = k.b ? bold : reg;
      if (i && !k.glue) cx += sp;
      page.drawText(k.w, { x: cx, y, size, font: f, color: color || rgb(0.1, 0.1, 0.1) });
      cx += f.widthOfTextAtSize(k.w, size);
    });
  };

  for (const [type, text, right] of blocks) {
    if (type === 'gap') { y -= 8; continue; }
    if (type === 'name') { need(34); y -= 22; page.drawText(clean(text), { x: M, y, size: 21, font: bold, color: NAVY }); y -= 6; }
    else if (type === 'line') { for (const l of wrap(text, 9.5, W - 2 * M)) { need(14); y -= 12; draw(l, M, 9.5, GREY); } y -= 3; }
    else if (type === 'tag') { for (const l of wrap(text, 10, W - 2 * M, true)) { need(14); y -= 12; draw(l, M, 10); } y -= 3; }
    else if (type === 'h') {
      need(30); y -= 17;
      page.drawText(clean(text).toUpperCase(), { x: M, y, size: 10.5, font: bold, color: NAVY });
      y -= 4;
      page.drawLine({ start: { x: M, y }, end: { x: W - M, y }, thickness: 0.7, color: NAVY });
      y -= 2;
    } else if (type === 'p') { for (const l of wrap(text, SIZE, W - 2 * M)) { need(LEAD + 2); y -= LEAD; draw(l, M, SIZE); } y -= 2; }
    else if (type === 'role') {
      need(26); y -= 14;
      const rt = clean(right || '');
      const rw = rt ? reg.widthOfTextAtSize(rt, 9.3) : 0;
      const lines = wrap(text, SIZE + 0.4, W - 2 * M - rw - 12, true);
      const top = y;
      lines.forEach((l, i) => { if (i) { need(LEAD); y -= LEAD; } draw(l, M, SIZE + 0.4, NAVY); });
      if (rt) page.drawText(rt, { x: W - M - rw, y: top, size: 9.3, font: reg, color: GREY });
      y -= 1;
    } else if (type === 'b') {
      const lines = wrap(text, SIZE, W - 2 * M - 14);
      lines.forEach((l, i) => { need(LEAD + 1); y -= LEAD; if (!i) page.drawText('-', { x: M + 2, y, size: SIZE, font: reg }); draw(l, M + 14, SIZE); });
      y -= 1;
    }
  }
  return Buffer.from(await pdf.save({ useObjectStreams: true }));
}
