import { figuresGrounded, locateQuote, norm, quoteInText, slug } from "./normalize.js";
const NEGATIVE_CLAIM = /^(no|not|none)\b|\b(has|have|had) not (been )?(evidenced|shown|demonstrated|stated)|\bno (personal |direct |individual )?(evidence|experience|record)\b|\blacks?\b|\babsent\b/i;
const TEAM_WORDS = /\b(we|our|us|team|together|jointly|collectively)\b/i;
const src = (l) => ({ page: l.page, section: l.section, filename: l.filename });
export function verifyExtraction(ex, docs, answerCorpus) {
    let dropped = 0;
    const findings = [];
    // ---- record elements: keep only what is really in the documents ----
    const keep = (items) => items.flatMap((it) => {
        const loc = locateQuote(docs, it.quote);
        if (!loc) {
            dropped++;
            return [];
        }
        return [{ ...it, source: src(loc) }];
    });
    const roles = [];
    for (const r of ex.roles) {
        const loc = locateQuote(docs, r.quote);
        if (!loc || !quoteInText(r.quote, r.employer) && !norm(r.quote).includes(norm(r.employer))) {
            dropped++;
            continue;
        }
        const startOk = r.start_text ? norm(r.quote).includes(norm(r.start_text)) : false;
        const endOk = r.end_text ? norm(r.quote).includes(norm(r.end_text)) : false;
        roles.push({
            employer: r.employer, title: r.title, quote: r.quote, location: r.location,
            start_text: startOk ? r.start_text : null, end_text: endOk ? r.end_text : null,
            // ISO dates are only kept when the written date really is in the quote.
            start_iso: startOk ? r.start_iso : null, end_iso: endOk ? r.end_iso : null,
            source: src(loc),
        });
    }
    const record = {
        profile: ex.profile,
        roles,
        education: keep(ex.education),
        certifications: keep(ex.certifications),
        listedSkills: keep(ex.listed_skills),
        eligibility: keep(ex.eligibility_statements),
        droppedUngrounded: 0,
    };
    // ---- claims ----
    const claims = [];
    for (const c of ex.claims) {
        // A claim is positive evidence. Statements of absence are gaps, not evidence, and are never saved as claims.
        if (NEGATIVE_CLAIM.test(c.claim)) {
            dropped++;
            continue;
        }
        // Trust where the quote REALLY is, not where the model says it is: a mislabelled source must not throw away good evidence.
        const docLoc = locateQuote(docs, c.quote);
        const answerHit = !docLoc && quoteInText(answerCorpus, c.quote);
        const origin = docLoc ? "document" : answerHit ? "answer" : c.quote_origin;
        const confirmed = !!c.confirmation_quote && quoteInText(answerCorpus, c.confirmation_quote);
        let status = c.status;
        let reason = null;
        let sourceKind = docLoc ? "document" : answerHit ? "answer" : null;
        if (!docLoc && !answerHit) {
            status = "unsupported";
            reason = "The supporting quote could not be found in the client's documents or answers.";
            dropped++;
        }
        else {
            // Figures must come from the source, not from the model.
            const fig = figuresGrounded(c.claim, [c.quote, c.confirmation_quote ?? ""]);
            if (!fig.ok) {
                status = "unsupported";
                reason = `Contains a figure (${fig.missing.join(", ")}) that is not in the quoted source.`;
            }
            else if (origin === "answer" || (status === "client_confirmed" && !confirmed)) {
                // A claim whose only source is the client's answer is "client-confirmed" (the client says so, unverified).
                status = answerHit || confirmed ? "client_confirmed" : "needs_confirmation";
                if (status === "needs_confirmation")
                    reason = "Marked confirmed, but no matching answer from the client was found.";
            }
            else if (confirmed) {
                status = "client_confirmed";
            }
            else if (status === "client_confirmed") {
                status = "needs_confirmation";
            }
            // Personal ownership is never assumed for results written as a team.
            if (c.category === "contribution_results" && status === "source_documented") {
                const teamish = c.ownership === "team" || c.ownership === "unclear" || TEAM_WORDS.test(c.quote);
                if (teamish) {
                    status = "needs_confirmation";
                    reason = "Written as a team result. The document does not say what this person personally did.";
                }
            }
        }
        if (!sourceKind && confirmed)
            sourceKind = "answer";
        claims.push({
            category: c.category, claim: c.claim, status, statusReason: reason,
            relevance: c.relevance, relevanceNote: c.relevance_note,
            ownership: c.ownership, location: docLoc, quote: c.quote, sourceKind,
        });
    }
    // ---- AI findings, each backed by verbatim quotes ----
    const findIn = (q, origin) => origin === "document" ? locateQuote(docs, q) : quoteInText(answerCorpus, q) ? { documentId: "answer", filename: "Client answer", page: null, section: null } : null;
    for (const k of ex.contradictions) {
        const a = findIn(k.quote_a, k.origin_a), b = findIn(k.quote_b, k.origin_b);
        if (!a || !b) {
            dropped++;
            continue;
        }
        findings.push({
            key: `contradiction:${slug(k.quote_a).slice(0, 25)}|${slug(k.quote_b).slice(0, 25)}`,
            kind: "contradiction", severity: "high", essential: true, title: k.title, detail: k.explanation,
            evidence: [
                { quote: k.quote_a, documentId: a.documentId, page: a.page, section: a.section },
                { quote: k.quote_b, documentId: b.documentId, page: b.page, section: b.section },
            ],
            origin: "ai",
        });
    }
    for (const t of ex.template_leftovers) {
        const loc = locateQuote(docs, t.quote);
        if (!loc) {
            dropped++;
            continue;
        }
        findings.push({
            key: `template:${slug(t.quote)}`, kind: "template_leftover", severity: "medium", essential: false,
            title: `Possible template leftover: “${t.quote.slice(0, 80)}”`, detail: t.explanation,
            evidence: [{ quote: t.quote, documentId: loc.documentId, page: loc.page, section: loc.section }], origin: "ai",
        });
    }
    for (const m of ex.missing_information) {
        findings.push({
            key: `missing:${slug(m.title)}`, kind: "missing_information", severity: m.essential ? "high" : "low", essential: m.essential,
            title: m.title, detail: m.why_it_matters, evidence: [], origin: "ai",
        });
    }
    record.droppedUngrounded = dropped;
    if (dropped > 0) {
        findings.push({
            key: "ungrounded-dropped", kind: "warning", severity: "low", essential: false,
            title: `${dropped} extracted item(s) were discarded because their source text could not be found`,
            detail: "This is the safeguard working: nothing is kept unless it can be traced to the client's own text.",
            evidence: [], origin: "code",
        });
    }
    return { record, claims, findings };
}
