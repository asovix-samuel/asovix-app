// Plain-English labels shared by the delivery screens.

export const STATUS = {
  received: { label: 'Received', tone: 'neutral' },
  extracting: { label: 'Extracting', tone: 'busy' },
  awaiting_information: { label: 'Awaiting essential information', tone: 'warn' },
  ready_for_positioning: { label: 'Ready for positioning', tone: 'good' },
  failed: { label: 'Failed', tone: 'bad' },
};

export const CLAIM_STATUS = {
  source_documented: { label: 'Source-documented', tone: 'good', hint: 'The document states it. Not independently verified.' },
  client_confirmed: { label: 'Client-confirmed', tone: 'blue', hint: 'The client says so in their own words. Not independently verified.' },
  needs_confirmation: { label: 'Needs confirmation', tone: 'warn', hint: 'Vague, unclear dates or ownership, or a team result. Ask before using.' },
  unsupported: { label: 'Unsupported', tone: 'bad', hint: 'Could not be traced to the client’s own text. Do not use.' },
};

export const CATEGORY = {
  role_skill: 'Role-specific skills & experience',
  communication: 'Communication',
  teamwork: 'Teamwork',
  coachability_learning: 'Coachability & learning',
  contribution_results: 'Contribution, results & scale',
};

export const PAYMENT = {
  verified_paid: { label: 'Paid (confirmed with the payment provider)', tone: 'good' },
  not_verified: { label: 'Payment NOT verified', tone: 'warn' },
  not_paid: { label: 'Not paid', tone: 'bad' },
  manual_test: { label: 'TEST record, no payment', tone: 'blue' },
};

export const KIND = {
  contradiction: 'Contradiction',
  date_conflict: 'Date conflict',
  date_overlap: 'Dates overlap',
  employment_gap: 'Gap in dates',
  missing_dates: 'Missing dates',
  missing_information: 'Missing information',
  template_leftover: 'Template leftover?',
  identity_mismatch: 'Identity mismatch',
  document_instruction: 'Text aimed at AI',
  warning: 'Note',
};

export const money = (v) => (v == null ? null : `$${Number(v).toFixed(4)}`);
export const secs = (ms) => (ms == null ? null : ms < 1000 ? `${ms} ms` : `${(ms / 1000).toFixed(1)} s`);
export const when = (iso) => (iso ? new Date(iso).toLocaleString('en-IE', { dateStyle: 'medium', timeStyle: 'short' }) : '');
export const pkgLabel = (PACKAGES, k) => PACKAGES[k] || k;
