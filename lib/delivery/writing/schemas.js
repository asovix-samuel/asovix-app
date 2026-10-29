// What the writing model may return. Facts it cannot change (names, employers, job titles, dates,
// qualifications) are NOT in these schemas: they come from the verified record and are filled in by code.
// Every line of positioning text carries the ids of the evidence it rests on (e1, e2...).
import { z } from 'zod';

const str = z.string();
const cited = z.object({
  text: str,
  evidence: z.array(str).describe('Ids of the evidence items (e1, e2...) this line rests on. At least one.'),
});

const notes = z.array(str).describe('Short notes for Samuel: the positioning decisions you made and anything he should check. Max 5.');

export const CvSchema = z.object({
  headline: str.describe('One line under the name: the positioning statement for the target role (not just a job title). Max 110 characters.'),
  summary: cited.describe('Professional summary, 3-4 sentences, WHY format: experience + education + core skills + why it matters for this role.'),
  key_skills: z.array(z.object({ skill: str, evidence: z.array(str) })).describe('6-10 skills relevant to the target role, each traceable to evidence.'),
  experience: z.array(z.object({
    role: str.describe('Role id from the record (r1, r2...). Every role in the record should appear unless it is irrelevant and old.'),
    bullets: z.array(cited).describe('2-5 bullets: action verb first, contribution and outcome, most role-relevant first.'),
  })),
  high_leverage_lines: z.array(str).describe('The 1-2 lines that most change how a recruiter sees this candidate in 6 seconds, copied from above.'),
  notes,
});

export const LinkedInSchema = z.object({
  headline: str.describe('LinkedIn headline: a positioning statement recruiters search for. Max 220 characters.'),
  about: cited.describe('About section: story + value + direction, first person, conversational, 120-260 words, short paragraphs separated by blank lines.'),
  experience: z.array(z.object({
    role: str.describe('Role id from the record (r1, r2...)'),
    description: cited.describe('2-4 sentences or short lines, first person, slightly more conversational than the CV.'),
  })),
  top_skills: z.array(str).describe('Up to 5 skills to pin, each stated or clearly shown in the evidence.'),
  notes,
});

export const CoverLetterSchema = z.object({
  company: str.describe('Employer name exactly as given in the job ad, or "" if no job ad names one.'),
  role_title: str.describe('Job title as given in the job ad, or the target role.'),
  greeting: str.describe('e.g. "Dear Hiring Manager,"'),
  paragraphs: z.array(cited).describe('3-4 paragraphs, first person, WHY format: why hire me, why my skills benefit you, close with a clear next step. Under 330 words in total.'),
  sign_off: str.describe('e.g. "Kind regards,"'),
  notes,
});

export const InterviewPackSchema = z.object({
  role_focus: str.describe('What the employer is really hiring to solve, in 2 sentences.'),
  likely_questions: z.array(z.object({
    question: str,
    why_they_ask: str,
    answer_outline: cited.describe('How this candidate should answer, using their real evidence.'),
  })).describe('6-8 questions, mixing role-specific, behavioural and motivation questions.'),
  stories: z.array(z.object({
    title: str,
    situation_task: cited,
    action_result: cited,
  })).describe('3-4 STAR stories built only from the evidence.'),
  risks: z.array(z.object({ concern: str, how_to_address: str })).describe('Up to 4 things an interviewer may worry about (gaps, level, visa) and how to handle them honestly.'),
  notes,
});

export const SCHEMAS = { cv: CvSchema, linkedin: LinkedInSchema, cover_letter: CoverLetterSchema, interview_pack: InterviewPackSchema };
export const TOOLS = { cv: 'write_cv', linkedin: 'write_linkedin', cover_letter: 'write_cover_letter', interview_pack: 'write_interview_pack' };
