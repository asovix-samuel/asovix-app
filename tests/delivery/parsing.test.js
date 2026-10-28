import { test } from "node:test";
import assert from "node:assert/strict";
import { extractDocument, sniffKind, ExtractionError } from "../../lib/delivery/parsing/extract.js";
import { extractDocx } from "../../lib/delivery/parsing/docx.js";

import { makeCvDocx, makeCvPdf, makeDocxWithTextBox, makePdf } from "./fixtures.js";

const all = (d) => d.segments.map((s) => s.text).join("\n");

test("PDF: every page is read and carries its page number and section", async () => {
  const doc = await extractDocument(await makeCvPdf(), "pdf");
  assert.equal(doc.pageCount, 2);
  const text = all(doc);
  assert.match(text, /reduced late deliveries by 18%/i);
  assert.match(text, /forklift certification in 2020/i, "page 2 (appended content) must be present");
  const p2 = doc.segments.filter((s) => s.page === 2);
  assert.ok(p2.length > 0);
  assert.ok(doc.segments.some((s) => s.page === 1 && s.section === "EXPERIENCE"));
  assert.ok(doc.segments.some((s) => s.page === 2 && s.section === "SKILLS"));
});

test("DOCX: headings, table rows and headers are all extracted", async () => {
  const doc = await extractDocument(await makeCvDocx(), "docx");
  const text = all(doc);
  assert.match(text, /Harbour Freight Ltd - Operations Coordinator \| Jan 2021 - Present/);
  assert.match(text, /Lee Valley Distribution - Logistics Assistant \| Mar 2019 - Dec 2020/);
  assert.match(text, /BA Business Studies/);
  assert.ok(doc.segments.some((s) => s.section === "Header" && /Confidential/.test(s.text)));
  assert.ok(doc.segments.some((s) => s.section === "Experience" && /Harbour Freight/.test(s.text)));
});

test("DOCX: text boxes are read once, not dropped and not duplicated by the fallback", async () => {
  const doc = await extractDocx(await makeDocxWithTextBox());
  const text = all(doc);
  assert.equal((text.match(/certified scrum master 2021/g) || []).length, 1);
});

test("a PDF with no text layer fails with a clear scanned-document message", async () => {
  const blank = await makePdf(["", ""]);
  await assert.rejects(() => extractDocument(blank, "pdf"), (e) => e instanceof ExtractionError && /scanned|image-only/i.test(e.message));
});

test("corrupt and mislabelled files are rejected by content, not by name", async () => {
  assert.equal(sniffKind(new TextEncoder().encode("not a pdf at all"), "cv.pdf"), null);
  assert.equal(sniffKind(await makeCvPdf(), "cv.docx"), null);
  assert.equal(sniffKind(await makeCvPdf(), "cv.pdf"), "pdf");
  assert.equal(sniffKind(await makeCvDocx(), "cv.docx"), "docx");
  const junk = new Uint8Array([0x50, 0x4b, 0x03, 0x04, 1, 2, 3, 4, 5]);
  await assert.rejects(() => extractDocument(junk, "docx"), ExtractionError);
});

const await_cv = await makeCvPdf();
test("an over-long document fails loudly instead of being truncated", async () => {
  await assert.rejects(() => extractDocument(await_cv, "pdf", 100), (e) => /too long/.test(e.message));
});
