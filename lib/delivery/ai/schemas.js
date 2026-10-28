// What the model is allowed to return. Everything is validated again after the call,
// and every quote is re-checked against the source text by evidence/verify.ts.
import { z } from "zod";
export const CATEGORIES = ["role_skill", "communication", "teamwork", "coachability_learning", "contribution_results"];
export const CLAIM_STATUSES = ["source_documented", "client_confirmed", "needs_confirmation", "unsupported"];
const str = z.string();
const nstr = z.string().nullable();
export const ExtractionSchema = z.object({
    profile: z.object({
        full_name: nstr.describe("Name as written at the top of the document, or null"),
        email: nstr,
        phone: nstr,
        location: nstr,
    }),
    roles: z.array(z.object({
        employer: str,
        title: str,
        start_text: nstr.describe("Start date exactly as written in the document, or null if absent"),
        end_text: nstr.describe("End date exactly as written, 'Present' if written so, or null if absent"),
        start_iso: nstr.describe("YYYY-MM or YYYY, only if start_text exists"),
        end_iso: nstr.describe("YYYY-MM, YYYY or 'present', only if end_text exists"),
        location: nstr,
        quote: str.describe("Verbatim line(s) from the document that name this role and its dates"),
    })),
    education: z.array(z.object({ institution: str, qualification: str, dates_text: nstr, quote: str })),
    certifications: z.array(z.object({ name: str, date_text: nstr, quote: str })),
    listed_skills: z.array(z.object({ skill: str, quote: str })),
    eligibility_statements: z.array(z.object({ statement: str, quote: str })),
    claims: z.array(z.object({
        category: z.enum(CATEGORIES),
        claim: str.describe("One plain statement of what the document says. No figures that are not in the quote."),
        status: z.enum(CLAIM_STATUSES),
        quote_origin: z.enum(["document", "answer"]),
        quote: str.describe("Verbatim text supporting the claim, copied exactly, max 300 characters"),
        confirmation_quote: nstr.describe("Verbatim text from a CANDIDATE ANSWER that confirms this claim, or null"),
        ownership: z.enum(["individual", "team", "unclear", "not_applicable"]).describe("Who did it, as stated"),
        relevance: z.enum(["high", "medium", "low", "none"]),
        relevance_note: str.describe("One sentence: why this matters (or not) for the target role"),
    })),
    contradictions: z.array(z.object({
        title: str,
        explanation: str,
        quote_a: str,
        origin_a: z.enum(["document", "answer"]),
        quote_b: str,
        origin_b: z.enum(["document", "answer"]),
    })),
    template_leftovers: z.array(z.object({ quote: str, explanation: str })),
    missing_information: z.array(z.object({
        title: str,
        why_it_matters: str,
        essential: z.boolean().describe("true only if the work cannot be done accurately without it"),
    })),
});
export const QuestionsSchema = z.object({
    questions: z.array(z.object({
        topic_key: str.describe("Short stable slug for the topic, e.g. 'lee-valley-dates'"),
        text: str.describe("One clear question addressed to the client, in plain English"),
        why: str.describe("One sentence for Samuel: what it changes in the work"),
        linked_ids: z.array(str).describe("Ids (c1, f2...) of the claims or findings this resolves"),
    })),
});
export function jsonSchema(schema) {
    const js = z.toJSONSchema(schema);
    delete js.$schema;
    return js;
}
