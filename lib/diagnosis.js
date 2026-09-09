// ── Asovix positioning diagnosis ──
// Questions, copy variants and the rules engine that turns answers into a
// diagnosis. Deliberately rule-based, not AI: it is transparent, instant, and
// never asserts more than the answers support.
//
// The engine is a pure function (runDiagnosis) so it can run on the client for
// an instant result AND on the server when saving the lead — same output both
// sides, no drift.

import { OFFERS } from './offers';

/* ──────────────────────────────────────────────────────────────
   A/B COPY VARIANTS
   Flip a value in ACTIVE to change what ships. No statistical
   testing here — this is just a single place to swap copy.
   ────────────────────────────────────────────────────────────── */
export const VARIANTS = {
  heroCta: {
    A: "Find out what's blocking you",
    B: 'Diagnose my job search',
  },
  heroSub: {
    A: "Asovix analyses what you're trying to achieve, what your experience actually proves, and what employers are hiring for — then shows you exactly how to position yourself.",
    B: "We identify why employers aren't responding — then reposition you for the roles you actually want.",
  },
  heroSecondary: {
    A: 'See how Asovix works',
    B: 'See candidate results',
  },
  stickyCta: {
    A: 'Get my diagnosis',
    B: "Find out what's blocking you",
  },
};

export const ACTIVE = {
  heroCta: 'A',
  heroSub: 'A',
  heroSecondary: 'A',
  stickyCta: 'A',
  proofPlacement: 'above_problem', // 'above_problem' | 'below_problem'
};

export const V = Object.keys(VARIANTS).reduce((acc, k) => {
  acc[k] = VARIANTS[k][ACTIVE[k]] || VARIANTS[k].A;
  return acc;
}, {});

/* ──────────────────────────────────────────────────────────────
   QUESTIONS
   ────────────────────────────────────────────────────────────── */
export const QUESTIONS = [
  {
    id: 'goal',
    type: 'single',
    q: 'What are you trying to achieve?',
    help: 'Pick the closest one.',
    options: [
      { v: 'grad_role', l: 'A graduate role' },
      { v: 'internship', l: 'An internship or placement' },
      { v: 'career_change', l: 'A career change' },
      { v: 'better_role', l: 'A better role than the one I have' },
      { v: 'part_time', l: 'Part-time or in-person work' },
      { v: 'unsure', l: "I'm not sure yet" },
    ],
  },
  {
    id: 'targetRole',
    type: 'text',
    q: 'What type of role are you targeting?',
    help: 'A job title is enough. For example: graduate sales, biomedical placement, data analyst, retail supervisor.',
    placeholder: 'e.g. Graduate Sales / SDR',
    optional: true,
  },
  {
    id: 'situation',
    type: 'multi',
    q: 'What is happening right now?',
    help: 'Choose everything that applies.',
    options: [
      { v: 'few_interviews', l: 'Applying, but getting few or no interviews' },
      { v: 'no_offers', l: 'Getting interviews, but no offers' },
      { v: 'unsure_roles', l: "I'm unsure what roles suit me" },
      { v: 'cv_weak', l: "My CV doesn't represent me properly" },
      { v: 'linkedin_weak', l: "My LinkedIn isn't helping" },
      { v: 'not_started', l: "I haven't started applying yet" },
      { v: 'other', l: 'Something else' },
    ],
  },
  {
    id: 'applications',
    type: 'single',
    q: 'Roughly how many applications have you sent recently?',
    options: [
      { v: '0', l: 'None yet' },
      { v: '1-10', l: '1–10' },
      { v: '11-30', l: '11–30' },
      { v: '31-50', l: '31–50' },
      { v: '50+', l: 'More than 50' },
    ],
  },
  {
    id: 'biggestProblem',
    type: 'single',
    q: 'What do you think your biggest problem is?',
    help: "Your instinct is useful, even if it turns out to be wrong.",
    options: [
      { v: 'positioning', l: 'How I present myself' },
      { v: 'experience', l: "I don't have enough experience" },
      { v: 'cv', l: 'My CV' },
      { v: 'linkedin', l: 'My LinkedIn' },
      { v: 'interviewing', l: 'Interviewing' },
      { v: 'targeting', l: 'Knowing which roles to go for' },
      { v: 'unsure', l: 'Honestly, not sure' },
    ],
  },
  {
    id: 'cv',
    type: 'file',
    q: 'Want a more accurate diagnosis?',
    help: 'Upload your current CV. Optional — the diagnosis works without it. PDF, DOCX or TXT.',
    optional: true,
  },
  {
    id: 'contact',
    type: 'contact',
    q: 'Where should we send it?',
    help: 'Your diagnosis appears on the next screen, and we email you a copy.',
    optional: false,
  },
];

/* ──────────────────────────────────────────────────────────────
   ENGINE
   ────────────────────────────────────────────────────────────── */

const GOAL_LABEL = {
  grad_role: 'a graduate role',
  internship: 'an internship or placement',
  career_change: 'a career change',
  better_role: 'a better role',
  part_time: 'part-time or in-person work',
  unsure: 'a direction you have not settled on yet',
};

const HIGH_VOLUME = ['31-50', '50+'];

const ISSUE = {
  cv: {
    headline: 'Your experience is stronger than your current positioning.',
    gap: 'Your CV is likely describing responsibilities rather than communicating evidence an employer can act on.',
    action: 'Rebuild your CV around measurable evidence and the requirements of one specific target role.',
  },
  linkedin: {
    headline: "Your CV may be fine. Your visibility isn't.",
    gap: 'Employers check LinkedIn before and after they meet you. If it does not say what you are good at and why it matters, it quietly costs you.',
    action: 'Rewrite your headline, About section and experience so they match the story your CV tells.',
  },
  interview: {
    headline: "You're getting seen. You're not converting the room.",
    gap: 'Reaching interview means your positioning on paper is working. The gap is in how the evidence gets presented in person.',
    action: 'Prepare a small set of evidence you can return to under pressure, rather than rehearsing many answers.',
  },
  targeting: {
    headline: "You're applying broadly instead of positioning precisely.",
    gap: 'Without one clear target, a CV has to appeal to everyone — which usually means it convinces no one.',
    action: 'Settle on a primary target role, then position your existing evidence against what that market is actually hiring for.',
  },
};

export function runDiagnosis(answers = {}) {
  const goal = answers.goal || 'unsure';
  const situation = Array.isArray(answers.situation) ? answers.situation : [];
  const applications = answers.applications || '0';
  const biggestProblem = answers.biggestProblem || 'unsure';
  const targetRole = (answers.targetRole || '').trim();

  const s = { cv: 0, linkedin: 0, interview: 0, targeting: 0 };

  // What they say is happening
  if (situation.includes('few_interviews')) { s.cv += 2; s.targeting += 1; }
  if (situation.includes('no_offers')) { s.interview += 3; }
  if (situation.includes('unsure_roles')) { s.targeting += 3; }
  if (situation.includes('cv_weak')) { s.cv += 3; }
  if (situation.includes('linkedin_weak')) { s.linkedin += 3; }
  if (situation.includes('not_started')) { s.cv += 1; s.targeting += 1; }

  // What they think the problem is
  if (biggestProblem === 'cv') s.cv += 3;
  if (biggestProblem === 'linkedin') s.linkedin += 3;
  if (biggestProblem === 'interviewing') s.interview += 3;
  if (biggestProblem === 'targeting') s.targeting += 3;
  if (biggestProblem === 'positioning') { s.cv += 2; s.linkedin += 1; }
  if (biggestProblem === 'experience') { s.cv += 2; }

  // Volume signal: lots of applications, few interviews = a positioning problem,
  // not an effort problem.
  const highVolume = HIGH_VOLUME.includes(applications);
  if (highVolume && situation.includes('few_interviews')) { s.cv += 2; s.targeting += 2; }
  if (!targetRole && goal === 'unsure') s.targeting += 2;

  // Nothing selected at all — default to the core method.
  if (s.cv + s.linkedin + s.interview + s.targeting === 0) s.cv += 1;

  const ranked = Object.keys(s).sort((a, b) => s[b] - s[a]);
  const top = ranked[0];
  const strong = ranked.filter((k) => s[k] >= 3);

  // ── Recommendation ──
  let recommended;
  if (goal === 'part_time' && top !== 'interview') {
    recommended = 'focused_cv';
  } else if (strong.length >= 3) {
    recommended = 'full_package';
  } else if (s.cv >= 3 && s.linkedin >= 3) {
    recommended = 'cv_linkedin';
  } else if (top === 'interview') {
    recommended = 'interview_prep';
  } else if (top === 'linkedin') {
    recommended = 'linkedin';
  } else {
    recommended = 'cv_positioning';
  }

  // ── Market alignment ──
  let alignment;
  if (!targetRole) {
    alignment = {
      level: 'Unclear',
      note: 'You have not named a target role yet, so there is nothing concrete to align your evidence against. That is the first thing to fix.',
    };
  } else if (highVolume && situation.includes('few_interviews')) {
    alignment = {
      level: 'Low',
      note: `You are applying at volume for ${targetRole} and not converting to interviews. That pattern usually means the evidence is there but is not being read as relevant.`,
    };
  } else if (situation.includes('no_offers')) {
    alignment = {
      level: 'Working on paper',
      note: `Your written positioning for ${targetRole} is doing its job — you are reaching interviews. The gap is later in the process.`,
    };
  } else {
    alignment = {
      level: 'Partial',
      note: `You have a target in ${targetRole}. What we would check is whether your evidence is expressed in the language that market actually hires against.`,
    };
  }

  // ── Evidence summary ──
  const evidenceBits = [];
  if (answers.cvProvided) evidenceBits.push('you shared your current CV, which is the fastest way for us to see what is being under-sold');
  if (applications !== '0') evidenceBits.push(`roughly ${applications === '50+' ? 'more than 50' : applications} applications sent recently`);
  if (biggestProblem === 'experience') evidenceBits.push('a belief that you do not have enough experience — in our work, that is usually evidence that has not been surfaced rather than evidence that is missing');
  const evidence = evidenceBits.length
    ? evidenceBits.join('; ')
    : 'Not much to go on yet — which is itself useful. The less evidence you can point to, the more likely it is that the evidence exists and has not been captured.';

  const issue = ISSUE[top];

  return {
    primaryIssue: issue.headline,
    biggestGap: issue.gap,
    nextAction: issue.action,
    target: targetRole
      ? `${targetRole} — you are targeting ${GOAL_LABEL[goal] || 'a new role'}.`
      : `You are targeting ${GOAL_LABEL[goal] || 'a new role'}, without a specific role named yet.`,
    evidence,
    alignment,
    signals: s,
    topSignal: top,
    recommended,
    offer: OFFERS[recommended],
  };
}
