// ── Delivery workspace: shared settings ──
//
// PRIVATE workspace for Samuel (pages/delivery, pages/api/delivery). Nothing in
// here is reachable without signing in, and nothing here changes the public
// checkout, diagnosis or confirmation-email flows.

/** Package keys mirror PRODUCTS in lib/checkout.js (the source of truth for what is charged). */
export const PACKAGES = {
  focused_cv: 'Focused CV',
  cv_positioning: 'CV Positioning',
  linkedin: 'LinkedIn Positioning',
  cover_letter: 'Cover Letter (add-on)',
  interview_prep: 'Interview Preparation',
  cv_linkedin: 'CV + LinkedIn',
  cv_linkedin_letter: 'CV + LinkedIn + Cover Letter',
  full_package: 'Full Career Positioning Package',
  revision_fee: 'Additional Revision',
  other: 'Other / not sure yet',
};

export const LIMITS = {
  // Vercel rejects request bodies over 4.5MB; stay under it for the multipart upload.
  maxFileBytes: 4 * 1024 * 1024,
  // Longer documents fail loudly rather than being silently cut short.
  maxDocChars: 120000,
  minUsableChars: 200,
  maxQuestions: 6,
  // Automatic attempts for one AI call inside a run (transient errors).
  aiAttempts: 2,
  // Total times one identical input may be (re)started before it must change.
  maxRunAttempts: 3,
  // A run with no heartbeat for this long is treated as interrupted (function timed out / restarted).
  staleRunMs: 6 * 60 * 1000,
  sessionHours: 12,
  loginMaxFails: 8,
  loginWindowMs: 15 * 60 * 1000,
};

// Bump when a prompt or verification rule changes, so identical inputs can be re-analysed.
export const PROMPT_VERSION = 'evidence-v5';

export const isProd = () => process.env.NODE_ENV === 'production';
