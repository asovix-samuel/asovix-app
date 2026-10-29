// ── Stage 2: code checks every draft against the evidence (the model proposes, code disposes) ──
//
// Errors block approval unless Samuel explicitly approves anyway; warnings are for his judgement.
// Checks run again after every edit, so a hand-typed figure is caught the same way.
import { loose, numbersIn } from '../evidence/normalize.js';
import { isFocused } from './plan.js';

export const BANNED = [
  'hardworking', 'hard-working', 'team player', 'responsible for', 'assisted with', 'involved in', 'duties included',
  'results-driven', 'results driven', 'self-starter', 'self starter', 'go-getter', 'passionate about', 'proven track record',
  'synergy', 'dynamic individual', 'detail-oriented', 'detail oriented',
];
const TEAM_WORDS = /\b(team|with|alongside|together|contribut|part of|supported|collaborat|group|colleagues|jointly|helped)\w*/i;
const WEAK_START = /^(i|my|was|were|responsible|duties|tasks|helped|assisted|worked on)\b/i;

/** Every piece of text in a draft, with the evidence it cites (null = a line that carries no citation by design). */
export function linesOf(kind, c) {
  const out = [];
  const add = (where, text, evidence = null, skill = false) => { if (typeof text === 'string') out.push({ where, text, evidence, skill }); };
  if (!c) return out;
  if (kind === 'cv') {
    add('Headline', c.headline);
    add('Summary', c.summary?.text, c.summary?.evidence || []);
    (c.key_skills || []).forEach((s, i) => add(`Skill ${i + 1}`, s.skill, s.evidence || [], true));
    (c.experience || []).forEach((r) => (r.bullets || []).forEach((b, j) => add(`${r.role} bullet ${j + 1}`, b.text, b.evidence || [])));
  } else if (kind === 'linkedin') {
    add('Headline', c.headline);
    add('About', c.about?.text, c.about?.evidence || []);
    (c.experience || []).forEach((r) => add(`${r.role} description`, r.description?.text, r.description?.evidence || []));
    (c.top_skills || []).forEach((s, i) => add(`Top skill ${i + 1}`, s));
  } else if (kind === 'cover_letter') {
    add('Role title', c.role_title);
    (c.paragraphs || []).forEach((p, i) => add(`Paragraph ${i + 1}`, p.text, p.evidence || []));
  } else if (kind === 'interview_pack') {
    (c.likely_questions || []).forEach((q, i) => add(`Question ${i + 1} answer`, q.answer_outline?.text, q.answer_outline?.evidence || []));
    (c.stories || []).forEach((s, i) => {
      add(`Story ${i + 1} situation`, s.situation_task?.text, s.situation_task?.evidence || []);
      add(`Story ${i + 1} action/result`, s.action_result?.text, s.action_result?.evidence || []);
    });
  }
  return out;
}

const wordCount = (s) => String(s || '').trim().split(/\s+/).filter(Boolean).length;

/**
 * ctx: { evidence: [{id, claim, quote, status, ownership}], record, sourceText, jobAd, package }
 * Returns [{ level: 'error' | 'warning', where, message }].
 */
export function checkDraft(kind, content, ctx) {
  const issues = [];
  const err = (where, message) => issues.push({ level: 'error', where, message });
  const warn = (where, message) => issues.push({ level: 'warning', where, message });
  const byId = new Map(ctx.evidence.map((e) => [e.id, e]));
  const roleCount = (ctx.record?.roles || []).length;
  const recordText = JSON.stringify(ctx.record || {});
  const allEvidenceNumbers = new Set(ctx.evidence.flatMap((e) => numbersIn(`${e.claim} ${e.quote}`)));
  const jobAdNumbers = new Set(numbersIn(ctx.jobAd || ''));
  const recordNumbers = new Set(numbersIn(recordText));
  const sourceLoose = loose(ctx.sourceText || '');

  for (const line of linesOf(kind, content)) {
    const text = line.text.trim();
    if (!text) { if (line.evidence) err(line.where, 'This line is empty.'); continue; }
    const lower = text.toLowerCase();
    for (const b of BANNED) if (lower.includes(b)) err(line.where, `Uses the generic phrase "${b}".`);

    // A skill may rest on the CV's own skills list instead of an evidence item, if it is written there.
    if (line.skill && !line.evidence.length) {
      if (!sourceLoose.includes(loose(text))) err(line.where, `"${text}" is not in the evidence or written anywhere in the client's documents or answers.`);
      continue;
    }
    if (line.evidence) {
      const ids = [...new Set(line.evidence)];
      const unknown = ids.filter((id) => !byId.has(id));
      const known = ids.filter((id) => byId.has(id)).map((id) => byId.get(id));
      if (unknown.length) err(line.where, `Cites evidence that does not exist (${unknown.join(', ')}).`);
      if (!known.length) { err(line.where, 'Not backed by any evidence item.'); continue; }
      // Figures must come from the cited evidence (years and dates may also come from the verified record).
      const pool = new Set(known.flatMap((e) => numbersIn(`${e.claim} ${e.quote}`)));
      const missing = numbersIn(text).filter((n) => !pool.has(n) && !(recordNumbers.has(n) && /^(19|20)\d\d$/.test(n)));
      if (missing.length) err(line.where, `Figure${missing.length > 1 ? 's' : ''} ${missing.join(', ')} not found in the evidence it cites.`);
      if (known.some((e) => e.ownership === 'team' || e.ownership === 'unclear') && !TEAM_WORDS.test(text) && known.every((e) => e.ownership !== 'individual')) {
        warn(line.where, 'Rests on a team result. Make sure it reads as a contribution, not a solo achievement.');
      }
      if (known.some((e) => e.status === 'needs_confirmation')) warn(line.where, 'Rests on evidence that still needs the client to confirm it.');
      if (kind === 'cv' && /bullet/.test(line.where) && WEAK_START.test(text)) warn(line.where, 'Start the bullet with a strong action verb.');
    } else {
      // Uncited lines (headlines, skills lists, titles) may not carry figures that are not in the evidence or job ad.
      const missing = numbersIn(text).filter((n) => !allEvidenceNumbers.has(n) && !jobAdNumbers.has(n));
      if (missing.length) err(line.where, `Figure${missing.length > 1 ? 's' : ''} ${missing.join(', ')} not found anywhere in the evidence.`);
    }
  }

  if (kind === 'cv' || kind === 'linkedin') {
    const cited = new Set((content?.experience || []).map((r) => r.role));
    for (const r of content?.experience || []) {
      const m = /^r(\d+)$/.exec(String(r.role));
      if (!m || Number(m[1]) < 1 || Number(m[1]) > roleCount) err(`Role ${r.role}`, 'Refers to a role that is not in the verified record.');
    }
    if (roleCount && !cited.size) err('Experience', 'No roles are included.');
  }

  if (kind === 'cv') {
    const words = linesOf(kind, content).reduce((n, l) => n + wordCount(l.text), 0);
    const limit = isFocused(ctx.package) ? 380 : 650;
    if (words > limit) warn('Length', `About ${words} words of positioning text; aim for under ${limit} so it ${isFocused(ctx.package) ? 'fits one page' : 'stays easy to scan'}.`);
  }
  if (kind === 'cover_letter') {
    const words = (content?.paragraphs || []).reduce((n, p) => n + wordCount(p.text), 0);
    if (words > 380) warn('Length', `About ${words} words; aim for under 330.`);
    if (content?.company && !loose(ctx.jobAd || '').includes(loose(content.company))) {
      err('Company', `"${content.company}" is not named in the job ad. Do not address the letter to a company we cannot see.`);
    }
    if (!ctx.jobAd) warn('Job ad', 'No job ad was given, so this letter is general. Add the job ad and regenerate for a tailored letter.');
  }
  if (kind === 'linkedin' && content?.headline && content.headline.length > 220) err('Headline', 'Longer than LinkedIn allows (220 characters).');
  return issues;
}

export const hasErrors = (checks) => (checks || []).some((c) => c.level === 'error');
