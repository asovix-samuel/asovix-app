// ── Stage 2: what each package delivers ──
//
// Package keys mirror PACKAGES in ../config.js. The interview pack is an internal brief
// for Samuel's mock interview: it is reviewed like the rest but never emailed to the client.

export const KINDS = ['cv', 'linkedin', 'cover_letter', 'interview_pack'];

export const KIND_LABELS = {
  cv: 'CV',
  linkedin: 'LinkedIn profile',
  cover_letter: 'Cover letter',
  interview_pack: 'Interview prep brief (for you, not sent)',
};

const PLAN = {
  focused_cv: ['cv'],
  cv_positioning: ['cv'],
  linkedin: ['linkedin'],
  cover_letter: ['cover_letter'],
  interview_prep: ['interview_pack'],
  cv_linkedin: ['cv', 'linkedin'],
  cv_linkedin_letter: ['cv', 'linkedin', 'cover_letter'],
  full_package: ['cv', 'linkedin', 'cover_letter', 'interview_pack'],
  revision_fee: [],
  other: ['cv'],
};

export function deliverablesFor(pkg) {
  return PLAN[pkg] ? [...PLAN[pkg]] : ['cv'];
}

/** Focused CV is the one-page product for entry-level, part-time and in-person roles. */
export const isFocused = (pkg) => pkg === 'focused_cv';

/** What is emailed to the client. */
export const clientFacing = (kind) => kind !== 'interview_pack';

/** Free revision rounds within 7 days: one, plus one extra round for bundles. */
export function revisionAllowance(pkg) {
  return ['cv_linkedin', 'cv_linkedin_letter', 'full_package'].includes(pkg) ? 2 : 1;
}

export const REVISION_WINDOW_DAYS = 7;
