// The analysis pipeline for ONE candidate. Pure with respect to storage: it receives that
// candidate's own documents and answers (nothing else exists in its scope) and returns drafts.
import { LIMITS } from "./config.js";
import { PermanentAiError, estimateCost } from "./ai/provider.js";
import { fence } from "./ai/prompts.js";
import { contactFindings, dateFindings, identityFindings, injectionFindings, templateLeftovers, yearsClaimFindings } from "./evidence/checks.js";
import { numbersIn, slug } from "./evidence/normalize.js";
import { verifyExtraction } from "./evidence/verify.js";
export class PipelineError extends Error {
}
const STOP = new Set("this that with from have been were your their there about which would could should into than then them they what when where while also very only such more most some other these those over under between because role roles candidate client cv document".split(" "));
const words = (s) => new Set(String(s).toLowerCase().replace(/[^a-z0-9 ]+/g, " ").split(/\s+/).filter((w) => w.length >= 4 && !STOP.has(w)));
/** Share of the issue's content words that also appear in an answered question and its answer. */
export function topicOverlap(issue, answered) {
    const a = words(issue), b = words(answered);
    if (a.size < 2) return 0;
    let hit = 0;
    for (const w of a) if (b.has(w)) hit++;
    return hit / a.size;
}
export function renderDocuments(docs) {
    return docs
        .map((d) => {
        const body = d.segments.map((s) => `[${s.page != null ? `page ${s.page}` : "no page"}${s.section ? ` | ${s.section}` : ""}]\n${s.text}`).join("\n\n");
        return fence(`document name="${d.filename.replace(/"/g, "'")}"`, body);
    })
        .join("\n\n");
}
export function renderAnswers(intake, answered) {
    const parts = [];
    if (intake.trim())
        parts.push(fence("answer source=\"intake notes\"", intake.trim()));
    for (const a of answered)
        parts.push(fence(`answer to="${a.text.replace(/"/g, "'").slice(0, 200)}"`, a.answer.trim()));
    if (!parts.length)
        return "";
    return `CANDIDATE ANSWERS (the client's own words. Unverified, but they can make a claim client_confirmed):\n${parts.join("\n\n")}`;
}
/** The text a "client-confirmed" quote must be found in: the client's words only, never our questions. */
export function answerCorpus(intake, answered) {
    return [intake, ...answered.map((a) => a.answer)].join("\n");
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function withRetry(operation, provider, opts, run) {
    for (let attempt = 1;; attempt++) {
        const t0 = Date.now();
        try {
            const r = await run();
            opts.onCall?.({ operation, attempt, model: provider.model, usage: r.usage, costUsd: estimateCost(r.usage), latencyMs: Date.now() - t0, success: true, error: null });
            return r;
        }
        catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            opts.onCall?.({ operation, attempt, model: provider.model, usage: { inputTokens: null, outputTokens: null }, costUsd: null, latencyMs: Date.now() - t0, success: false, error: msg.slice(0, 400) });
            if (err instanceof PermanentAiError || attempt >= opts.attempts)
                throw err;
            await sleep(opts.retryDelayMs * attempt);
        }
    }
}
export async function runPipeline(input, provider, options = {}) {
    const now = options.now ?? new Date();
    const o = { attempts: options.attempts ?? LIMITS.aiAttempts, retryDelayMs: options.retryDelayMs ?? 1500, onCall: options.onCall };
    const { candidate, documents } = input;
    if (!documents.length)
        throw new PipelineError("No readable document is attached to this candidate.");
    const answersText = renderAnswers(input.intakeAnswers, input.answered);
    const corpus = answerCorpus(input.intakeAnswers, input.answered);
    // 1. Extract evidence (model proposes).
    // A saved checkpoint means this step already succeeded in an earlier attempt of the same run: do not pay for it twice.
    let extractionData = options.checkpoint || null;
    if (!extractionData) {
        await options.onStep?.("evidence");
        const extraction = await withRetry("extract_evidence", provider, o, () => provider.extractEvidence({
            today: now.toISOString().slice(0, 10),
            target: { role: candidate.targetRole, location: candidate.location, goal: candidate.goal },
            documentsText: renderDocuments(documents),
            answersText,
        }));
        extractionData = extraction.data;
        await options.onCheckpoint?.(extractionData);
    }
    // 2. Verify against the source text (code disposes).
    let verified = verifyExtraction(extractionData, documents, corpus);
    // Figures the client stated in their own answers must not vanish from the evidence. If any are missing from every
    // usable claim, ask the model once more, naming them, and keep whichever extraction captures more.
    const uncaptured = (v) => {
        const pool = new Set(v.claims.filter((c) => c.status !== "unsupported").flatMap((c) => numbersIn(`${c.claim} ${c.quote}`)));
        return [...new Set(numbersIn(corpus))].filter((n) => n.length > 1 && !pool.has(n));
    };
    if (!options.checkpoint && corpus.trim()) {
        const missing = uncaptured(verified);
        if (missing.length) {
            const retry = await withRetry("extract_evidence_recheck", provider, o, () => provider.extractEvidence({
                today: now.toISOString().slice(0, 10),
                target: { role: candidate.targetRole, location: candidate.location, goal: candidate.goal },
                documentsText: renderDocuments(documents),
                answersText,
                note: `Your previous extraction left out these figures the client stated in their answers: ${missing.join(", ")}. Add a claim for each, quoting the CANDIDATE ANSWER verbatim. Do not change or invent anything else.`,
            }));
            const again = verifyExtraction(retry.data, documents, corpus);
            if (uncaptured(again).length < missing.length && again.claims.some((c) => c.status !== "unsupported")) {
                extractionData = retry.data;
                verified = again;
                await options.onCheckpoint?.(extractionData);
            }
        }
    }
    if (!verified.claims.some((c) => c.status !== "unsupported")) {
        throw new PipelineError("No evidence in the documents could be traced to its source text, so nothing was saved. Check the file is the right one and readable, then retry.");
    }
    // 3. Deterministic checks.
    const fullText = documents.flatMap((d) => d.segments.map((s) => s.text)).join("\n");
    const raw = [
        ...verified.findings,
        ...dateFindings(verified.record.roles, now),
        ...yearsClaimFindings(fullText, verified.record.roles, now, documents),
        ...templateLeftovers(documents),
        ...identityFindings(documents, { name: candidate.name, email: candidate.email }, verified.record.profile),
        ...injectionFindings(documents),
        ...contactFindings(fullText, candidate.email),
    ];
    // De-duplicate by key (an AI and a code check can describe the same thing).
    const byKey = new Map();
    for (const f of raw)
        if (!byKey.has(f.key))
            byKey.set(f.key, f);
    // Issues the client has already answered are shown as addressed and never re-asked.
    const addressedKeys = new Set(input.answered.flatMap((a) => a.linkedKeys));
    // AI-worded issues have no stable key, so one the client has already been asked about (and answered) is
    // recognised by topic overlap with the answered question and its answer, and is not asked a second time.
    const findings = [...byKey.values()].map((f) => ({
        ...f,
        addressed: addressedKeys.has(f.key) || (f.origin === "ai" && input.answered.some((a) => topicOverlap(`${f.title} ${f.detail}`, `${a.text} ${a.answer}`) >= 0.3)),
    }));
    const open = findings.filter((f) => !f.addressed);
    // 4. Questions.
    const claimIds = verified.claims.map((_, i) => `c${i + 1}`);
    const findingIds = open.map((_, i) => `f${i + 1}`);
    const needsAttention = open.some((f) => f.kind !== "warning" && f.kind !== "document_instruction") || verified.claims.some((c) => c.status === "needs_confirmation");
    let questions = [];
    if (needsAttention) {
        await options.onStep?.("questions");
        const asked = await withRetry("generate_questions", provider, o, () => provider.generateQuestions({
            target: { role: candidate.targetRole, location: candidate.location },
            claims: verified.claims.map((c, i) => ({ id: claimIds[i], category: c.category, claim: c.claim, status: c.status, relevance: c.relevance })),
            findings: open.map((f, i) => ({ id: findingIds[i], kind: f.kind, severity: f.severity, essential: f.essential, title: f.title, detail: f.detail })),
            answersText,
        }));
        const seenTopics = new Set();
        for (const q of asked.data.questions) {
            const topicKey = slug(q.topic_key || q.text);
            const linkedFindings = q.linked_ids.map((id) => findingIds.indexOf(id)).filter((i) => i >= 0).map((i) => open[i]);
            const linkedClaims = q.linked_ids.filter((id) => claimIds.includes(id));
            if (!linkedFindings.length && !linkedClaims.length)
                continue; // must tie to real evidence
            if (seenTopics.has(topicKey))
                continue;
            seenTopics.add(topicKey);
            questions.push({
                topicKey, text: q.text.trim(), why: q.why.trim(),
                essential: linkedFindings.some((f) => f.essential),
                linkedKeys: linkedFindings.map((f) => f.key),
            });
        }
        questions.sort((a, b) => Number(b.essential) - Number(a.essential));
        questions = questions.slice(0, LIMITS.maxQuestions);
        // An essential issue must never be left without a question, or the status would wrongly read "ready".
        for (const f of open.filter((x) => x.essential)) {
            if (!questions.some((q) => q.linkedKeys.includes(f.key))) {
                questions.push({ topicKey: `finding-${slug(f.key)}`, text: `Could you clarify this for us: ${f.title}?`.slice(0, 500), why: "Essential to accuracy; the analysis flagged it and no other question covers it.", essential: true, linkedKeys: [f.key] });
            }
        }
    }
    return { record: verified.record, claims: verified.claims, findings, questions };
}
export function sumUsage(calls) {
    const ok = calls.filter((c) => c.success);
    const sum = (f) => (ok.length && ok.every((c) => f(c) != null) ? ok.reduce((n, c) => n + f(c), 0) : null);
    // Failed attempts may still have cost money, but providers report no usage for them; we only sum what was reported.
    return { input: sum((c) => c.usage.inputTokens), output: sum((c) => c.usage.outputTokens), cost: sum((c) => c.costUsd) };
}
