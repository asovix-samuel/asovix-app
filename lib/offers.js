// ── Canonical Asovix offer catalogue ──
// SINGLE SOURCE OF TRUTH for prices shown anywhere on the site.
//
// These `price` values (euros) must always equal the `amount` values (cents)
// in pages/api/create-checkout.js, which is what Stripe actually charges.
// Import from here rather than hard-coding a price in a component.

export const OFFERS = {
  focused_cv: {
    id: 'focused_cv',
    name: 'Focused CV',
    price: 45,
    short: 'A single-page CV for entry-level, part-time or in-person roles.',
  },
  cv_positioning: {
    id: 'cv_positioning',
    name: 'CV Positioning',
    price: 65,
    short: 'Full evidence extraction and positioning for career-level roles.',
  },
  linkedin: {
    id: 'linkedin',
    name: 'LinkedIn Positioning',
    price: 55,
    short: 'Your profile rebuilt around how recruiters search, filter and read.',
  },
  cover_letter: {
    id: 'cover_letter',
    name: 'Cover Letter',
    price: 25,
    short: 'Add-on to a CV Positioning or bundle order. Not sold on its own.',
  },
  interview_prep: {
    id: 'interview_prep',
    name: 'Interview Preparation',
    price: 85,
    short: 'A tailored mock interview plus structured, evidence-based feedback.',
  },
  cv_linkedin: {
    id: 'cv_linkedin',
    name: 'CV + LinkedIn',
    price: 110,
    short: 'CV Positioning and LinkedIn Positioning, working as one story.',
  },
  cv_linkedin_letter: {
    id: 'cv_linkedin_letter',
    name: 'CV + LinkedIn + Cover Letter',
    price: 145,
    short: 'CV Positioning, LinkedIn Positioning and a tailored cover letter.',
  },
  full_package: {
    id: 'full_package',
    name: 'Full Career Positioning',
    price: 225,
    short: 'CV, LinkedIn, cover letter and interview preparation together.',
  },
};

export function offer(id) {
  return OFFERS[id] || null;
}
