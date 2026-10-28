// Heuristic section detection shared by the PDF and DOCX readers, so every
// segment can say "Experience", "Education", ... as its source location.
// A Segment is { page: number|null, section: string|null, text: string }.

const KNOWN_HEADINGS =
  /^(professional\s+)?(summary|profile|objective|experience|work\s+experience|employment(\s+history)?|education|qualifications?|skills|key\s+skills|technical\s+skills|projects?|certifications?|training|languages|interests|references|volunteering|achievements|awards|publications|additional\s+information|personal\s+details|contact)\s*:?$/i;

export function looksLikeHeading(line, styleIsHeading = false) {
  const t = line.trim();
  if (!t || t.length > 60) return false;
  if (styleIsHeading) return true;
  if (KNOWN_HEADINGS.test(t)) return true;
  const letters = t.replace(/[^A-Za-z]/g, '');
  return letters.length >= 4 && t.length <= 40 && t === t.toUpperCase() && !/\d{3,}/.test(t) && !/[.,;]$/.test(t);
}

/** Groups lines ({text, heading?}) into segments, starting a new segment at each heading. */
export function segmentLines(lines, page, startSection) {
  const segments = [];
  let section = startSection;
  let buf = [];
  const flush = () => {
    const text = buf.join('\n').trim();
    if (text) segments.push({ page, section, text });
    buf = [];
  };
  for (const l of lines) {
    const t = l.text.replace(/\s+$/g, '');
    if (!t.trim()) continue;
    if (looksLikeHeading(t, l.heading)) {
      flush();
      section = t.trim().replace(/:$/, '');
    }
    buf.push(t);
  }
  flush();
  return { segments, lastSection: section };
}

export class ExtractionError extends Error {}
