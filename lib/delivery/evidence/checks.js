// Deterministic checks that never depend on the model: dates, gaps, template leftovers,
// identity mismatches and text that tries to instruct the AI.
import { norm, slug, locateQuote } from "./normalize.js";
// ---------- dates ----------
/** "2021-03" | "2021" | "present" -> month index (year*12+month0) or null. */
export function monthIndex(iso, now, edge) {
    if (!iso)
        return null;
    const t = iso.trim().toLowerCase();
    if (t === "present" || t === "current" || t === "now")
        return now.getUTCFullYear() * 12 + now.getUTCMonth();
    const m = /^(\d{4})(?:-(\d{1,2}))?$/.exec(t);
    if (!m)
        return null;
    const y = Number(m[1]);
    if (y < 1950 || y > 2100)
        return null;
    if (m[2])
        return y * 12 + (Number(m[2]) - 1);
    return y * 12 + (edge === "start" ? 0 : 11); // year-only: widest sensible reading of the other edge
}
const isPresent = (iso) => !!iso && /^(present|current|now)$/i.test(iso.trim());
const label = (r) => `${r.title || "Role"} at ${r.employer}`;
export function dateFindings(roles, now) {
    const out = [];
    const nowIdx = now.getUTCFullYear() * 12 + now.getUTCMonth();
    const dated = roles.map((r) => ({ r, s: monthIndex(r.start_iso, now, "start"), e: monthIndex(r.end_iso, now, "end") }));
    for (const { r, s, e } of dated) {
        const key = slug(`${r.employer}-${r.title}`);
        if (s != null && e != null && e < s) {
            out.push({
                key: `end-before-start:${key}`, kind: "date_conflict", severity: "high", essential: true,
                title: `${label(r)}: end date is before the start date`,
                detail: `The document gives ${r.start_text ?? r.start_iso} to ${r.end_text ?? r.end_iso}.`,
                evidence: [{ quote: r.quote }], origin: "code",
            });
        }
        if (s != null && s > nowIdx) {
            out.push({
                key: `future-start:${key}`, kind: "date_conflict", severity: "medium", essential: true,
                title: `${label(r)}: starts in the future`,
                detail: `Start date ${r.start_text ?? r.start_iso} is after today. Check for a typo.`,
                evidence: [{ quote: r.quote }], origin: "code",
            });
        }
        else if (e != null && !isPresent(r.end_iso) && e > nowIdx) {
            out.push({
                key: `future-end:${key}`, kind: "date_conflict", severity: "medium", essential: false,
                title: `${label(r)}: end date is in the future`,
                detail: `End date ${r.end_text ?? r.end_iso} has not happened yet. It may be a planned end or a typo.`,
                evidence: [{ quote: r.quote }], origin: "code",
            });
        }
        if (!r.start_iso || !r.end_iso) {
            const missing = !r.start_iso && !r.end_iso ? "start and end dates" : !r.start_iso ? "start date" : "end date";
            out.push({
                key: `missing-dates:${key}`, kind: "missing_dates", severity: "medium", essential: !r.start_iso,
                title: `${label(r)}: no ${missing} in the document`,
                detail: "Dates affect how long the experience can truthfully be described as.",
                evidence: [{ quote: r.quote }], origin: "code",
            });
        }
    }
    // Same employer + same title listed twice with different dates.
    for (let i = 0; i < dated.length; i++) {
        for (let j = i + 1; j < dated.length; j++) {
            const a = dated[i].r, b = dated[j].r;
            if (norm(a.employer) === norm(b.employer) && norm(a.title) === norm(b.title) && (a.start_iso !== b.start_iso || a.end_iso !== b.end_iso)) {
                out.push({
                    key: `duplicate-role:${slug(a.employer)}-${slug(a.title)}`, kind: "date_conflict", severity: "high", essential: true,
                    title: `${label(a)} appears twice with different dates`,
                    detail: `${a.start_text ?? "?"} to ${a.end_text ?? "?"} versus ${b.start_text ?? "?"} to ${b.end_text ?? "?"}.`,
                    evidence: [{ quote: a.quote }, { quote: b.quote }], origin: "code",
                });
            }
        }
    }
    // Overlaps between different roles.
    for (let i = 0; i < dated.length; i++) {
        for (let j = i + 1; j < dated.length; j++) {
            const A = dated[i], B = dated[j];
            if (A.s == null || A.e == null || B.s == null || B.e == null)
                continue;
            if (norm(A.r.employer) === norm(B.r.employer) && norm(A.r.title) === norm(B.r.title))
                continue;
            const overlap = Math.min(A.e, B.e) - Math.max(A.s, B.s);
            if (overlap > 3) {
                out.push({
                    key: `overlap:${slug(A.r.employer + A.r.title)}|${slug(B.r.employer + B.r.title)}`,
                    kind: "date_overlap", severity: overlap > 12 ? "high" : "medium", essential: overlap > 12,
                    title: `${label(A.r)} and ${label(B.r)} overlap by about ${overlap} months`,
                    detail: "Both are listed as running at the same time. That can be genuine (part-time, freelance, a handover) but must be confirmed before dates are used.",
                    evidence: [{ quote: A.r.quote }, { quote: B.r.quote }], origin: "code",
                });
            }
        }
    }
    // Gaps between consecutive roles.
    const sorted = dated.filter((d) => d.s != null && d.e != null).sort((a, b) => a.s - b.s);
    let reach = sorted.length ? sorted[0].e : 0;
    for (let i = 1; i < sorted.length; i++) {
        const gap = sorted[i].s - reach - 1;
        if (gap > 6) {
            out.push({
                key: `gap:${slug(sorted[i - 1].r.employer)}|${slug(sorted[i].r.employer)}`,
                kind: "employment_gap", severity: gap > 12 ? "medium" : "low", essential: false,
                title: `About ${gap} months with no role listed before ${label(sorted[i].r)}`,
                detail: "Not a problem in itself, but employers ask. What was the person doing (study, caring, travel, job search, other work)?",
                evidence: [{ quote: sorted[i].r.quote }], origin: "code",
            });
        }
        reach = Math.max(reach, sorted[i].e);
    }
    return out;
}
export function yearsClaimFindings(text, roles, now, docs) {
    const spans = roles
        .map((r) => ({ s: monthIndex(r.start_iso, now, "start"), e: monthIndex(r.end_iso, now, "end") }))
        .filter((x) => x.s != null && x.e != null);
    if (!spans.length)
        return [];
    const spanYears = (Math.max(...spans.map((x) => x.e)) - Math.min(...spans.map((x) => x.s)) + 1) / 12;
    const out = [];
    const re = /\b(\d{1,2})\s*\+?\s*(?:years?|yrs?)\b[^.\n]{0,40}\bexperience\b/gi;
    let m;
    while ((m = re.exec(text))) {
        const claimed = Number(m[1]);
        if (claimed - spanYears > 1.5) {
            const quote = m[0];
            const loc = locateQuote(docs, quote);
            out.push({
                key: `years-claim:${claimed}`, kind: "date_conflict", severity: "medium", essential: true,
                title: `Document claims ${claimed} years of experience; the dated roles add up to about ${spanYears.toFixed(1)}`,
                detail: "Either a role is missing dates or the claim is overstated. It should not be repeated until resolved.",
                evidence: [{ quote, documentId: loc?.documentId, page: loc?.page, section: loc?.section }], origin: "code",
            });
        }
    }
    return out;
}
// ---------- template leftovers ----------
const TEMPLATE_PATTERNS = [
    [/\[[^\]\n]{2,40}\]/g, "square-bracket placeholder"],
    [/<(?:your|insert|company|name|job|date)[^>\n]{0,30}>/gi, "angle-bracket placeholder"],
    [/lorem ipsum/gi, "lorem ipsum filler text"],
    [/\b(?:your|insert)\s+(?:name|company(?:\s+name)?|job\s+title|email(?:\s+address)?|phone(?:\s+number)?|address|city)\b/gi, "unfilled template field"],
    [/\b(?:john|jane)\s+(?:doe|smith)\b/gi, "stock sample name"],
    [/\b(?:company|employer|university|school)\s+name\b/gi, "unfilled template field"],
    [/\b(?:xx{2,}|x{3,}@|yyyy|dd\/mm\/yyyy)\b/gi, "unfilled date/number"],
    [/\bsample\s+(?:text|cv|resume)\b/gi, "sample text"],
];
export function templateLeftovers(docs) {
    const out = [];
    const seen = new Set();
    for (const d of docs) {
        for (const s of d.segments) {
            for (const [re, what] of TEMPLATE_PATTERNS) {
                re.lastIndex = 0;
                for (const m of s.text.matchAll(re)) {
                    const k = `${what}:${norm(m[0])}`;
                    if (seen.has(k))
                        continue;
                    seen.add(k);
                    out.push({
                        key: `template:${slug(m[0])}`, kind: "template_leftover", severity: "medium", essential: false,
                        title: `Possible template leftover: “${m[0].trim()}”`,
                        detail: `Looks like a ${what}. Check that it is not left over from another document.`,
                        evidence: [{ quote: m[0], documentId: d.id, page: s.page, section: s.section }], origin: "code",
                    });
                }
            }
        }
    }
    return out;
}
// ---------- identity ----------
export function identityFindings(docs, candidate, profile) {
    const out = [];
    if (profile.full_name) {
        const a = new Set(norm(candidate.name).split(/[^a-z]+/).filter((t) => t.length > 1));
        const b = norm(profile.full_name).split(/[^a-z]+/).filter((t) => t.length > 1);
        if (a.size && b.length && !b.some((t) => a.has(t))) {
            const loc = locateQuote(docs, profile.full_name);
            out.push({
                key: "name-mismatch", kind: "identity_mismatch", severity: "high", essential: true,
                title: `The document is headed “${profile.full_name}”, not “${candidate.name}”`,
                detail: "This may be the wrong file, or a template reused from another person. Do not use anything from it until confirmed.",
                evidence: [{ quote: profile.full_name, documentId: loc?.documentId, page: loc?.page, section: loc?.section }], origin: "code",
            });
        }
    }
    if (profile.email && candidate.email && norm(profile.email) !== norm(candidate.email)) {
        out.push({
            key: "email-mismatch", kind: "identity_mismatch", severity: "medium", essential: false,
            title: `The document lists ${profile.email}; the order lists ${candidate.email}`,
            detail: "Confirm which email the client actually uses.",
            evidence: [{ quote: profile.email }], origin: "code",
        });
    }
    return out;
}
// ---------- documents that talk to the AI ----------
const INJECTION = [
    /ignore\s+(?:all\s+|any\s+|the\s+)?(?:previous|prior|above|earlier)\s+(?:instructions?|prompts?|rules)/i,
    /disregard\s+(?:all\s+|any\s+|the\s+)?(?:previous|prior|above)\s+(?:instructions?|prompts?)/i,
    /\byou\s+are\s+now\b/i,
    /\bsystem\s+prompt\b/i,
    /\bas\s+an\s+ai\b/i,
    /\b(?:assistant|system)\s*:\s/i,
    /rate\s+(?:this|the)\s+(?:candidate|cv|resume)\s+(?:as\s+)?(?:highly|10|excellent)/i,
    /do\s+not\s+(?:flag|mention|report)\s+(?:any|this)/i,
];
export function injectionFindings(docs) {
    const out = [];
    for (const d of docs) {
        for (const s of d.segments) {
            for (const re of INJECTION) {
                const m = re.exec(s.text);
                if (m) {
                    out.push({
                        key: `injection:${slug(m[0])}`, kind: "document_instruction", severity: "high", essential: false,
                        title: "The document contains text that looks like instructions to an AI",
                        detail: "It was treated as ordinary content and not obeyed. Check whether it is hidden or pasted text.",
                        evidence: [{ quote: m[0], documentId: d.id, page: s.page, section: s.section }], origin: "code",
                    });
                    break;
                }
            }
        }
    }
    return out;
}
// ---------- contact ----------
export function contactFindings(text, candidateEmail) {
    const hasEmail = /[^\s@]+@[^\s@]+\.[^\s@]+/.test(text);
    if (hasEmail || candidateEmail)
        return [];
    return [{
            key: "no-contact", kind: "missing_information", severity: "low", essential: false,
            title: "No email address in the document or on the order", detail: "Needed to deliver the finished work.", evidence: [], origin: "code",
        }];
}
