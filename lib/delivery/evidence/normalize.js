export function norm(s) {
    return s
        .normalize("NFKC")
        .toLowerCase()
        .replace(/[‘’‚′]/g, "'")
        .replace(/[“”„″]/g, '"')
        .replace(/[‐-―−]/g, "-")
        .replace(/[•●▪·‣◦]/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}
/** Letters and digits only: survives line-wrap hyphenation, odd spacing and bullet glyphs from PDFs. */
export function loose(s) {
    return norm(s).replace(/[^a-z0-9%€£$]+/g, "");
}
/** Finds a quote in a candidate's documents. Also tries a segment joined with the next, for text split by a heading or page. */
export function locateQuote(docs, quote) {
    if (!quote)
        return null;
    const q = loose(quote);
    if (q.length < 6)
        return null;
    // Pass 1: the quote sits inside one segment (the normal case, and the precise answer).
    for (const d of docs) {
        for (const s of d.segments) {
            if (loose(s.text).includes(q))
                return { documentId: d.id, filename: d.filename, page: s.page, section: s.section };
        }
    }
    // Pass 2: the quote straddles a heading or page break, so it spans two neighbouring segments.
    for (const d of docs) {
        for (let i = 0; i + 1 < d.segments.length; i++) {
            if ((loose(d.segments[i].text) + loose(d.segments[i + 1].text)).includes(q)) {
                const s = d.segments[i];
                return { documentId: d.id, filename: d.filename, page: s.page, section: s.section };
            }
        }
    }
    return null;
}
export function quoteInText(text, quote) {
    if (!quote)
        return false;
    const q = loose(quote);
    return q.length >= 6 && loose(text).includes(q);
}
/** Numbers as they would be compared: "18%", "1,200", "6". */
export function numbersIn(s) {
    return (s.match(/\d[\d,.]*\d|\d/g) || []).map((n) => n.replace(/[,.]+$/g, "").replace(/,/g, ""));
}
/** Every figure in `claim` must appear in the quoted source; otherwise the figure was invented or derived. */
export function figuresGrounded(claim, sources) {
    const pool = new Set(sources.flatMap((s) => numbersIn(s)));
    const missing = numbersIn(claim).filter((n) => !pool.has(n));
    return { ok: missing.length === 0, missing };
}
export function slug(s) {
    return norm(s).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || "item";
}
