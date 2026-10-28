// Synthetic fixtures only. "Jordan Test" and every employer here are fictional.
import { PDFDocument, StandardFonts } from "pdf-lib";
import { Document, Header, HeadingLevel, Packer, Paragraph, Table, TableCell, TableRow, TextRun, WidthType } from "docx";
import JSZip from "jszip";
/** One string per page; lines separated by \n. */
export async function makePdf(pages) {
    const pdf = await PDFDocument.create();
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    for (const text of pages) {
        const page = pdf.addPage([595, 842]);
        let y = 790;
        for (const line of text.split("\n")) {
            if (line)
                page.drawText(line, { x: 50, y, size: 11, font });
            y -= 16;
        }
    }
    return pdf.save();
}
export const CV_PAGE_1 = [
    "JORDAN TEST",
    "jordan.test@example.com | Cork, Ireland",
    "PROFILE",
    "Operations coordinator with experience in warehouse logistics and customer support.",
    "EXPERIENCE",
    "Operations Coordinator, Harbour Freight Ltd, Jan 2021 - Present",
    "Coordinated daily dispatch for a team of 6 drivers and reduced late deliveries by 18% over 2022.",
    "Wrote weekly status updates for the regional manager.",
    "Logistics Assistant, Lee Valley Distribution, Mar 2019 - Dec 2020",
    "We delivered the warehouse relocation project on time.",
].join("\n");
export const CV_PAGE_2 = [
    "EDUCATION",
    "BA Business Studies, University College Cork, 2014 - 2018",
    "SKILLS",
    "Excel, SAP, route planning, team scheduling",
    "Completed a first aid course and a forklift certification in 2020 and asked for feedback each quarter.",
].join("\n");
export async function makeCvPdf() {
    return makePdf([CV_PAGE_1, CV_PAGE_2]);
}
/** A DOCX with a heading, a table, and a header, so extraction of all three can be proven. */
export async function makeCvDocx(opts = {}) {
    const row = (a, b) => new TableRow({ children: [a, b].map((t) => new TableCell({ width: { size: 50, type: WidthType.PERCENTAGE }, children: [new Paragraph(t)] })) });
    const doc = new Document({
        sections: [
            {
                headers: { default: new Header({ children: [new Paragraph("Confidential - Jordan Test CV")] }) },
                children: [
                    new Paragraph({ text: "Jordan Test", heading: HeadingLevel.TITLE }),
                    new Paragraph("jordan.test@example.com"),
                    new Paragraph({ text: "Experience", heading: HeadingLevel.HEADING_1 }),
                    new Table({
                        width: { size: 100, type: WidthType.PERCENTAGE },
                        rows: [
                            row("Employer", "Dates"),
                            row("Harbour Freight Ltd - Operations Coordinator", "Jan 2021 - Present"),
                            row("Lee Valley Distribution - Logistics Assistant", opts.overlappingDates ? "Mar 2020 - Dec 2022" : "Mar 2019 - Dec 2020"),
                        ],
                    }),
                    new Paragraph({ children: [new TextRun("Reduced late deliveries by 18% over 2022 while coordinating 6 drivers.")] }),
                    new Paragraph({ text: "Education", heading: HeadingLevel.HEADING_1 }),
                    new Paragraph("BA Business Studies, University College Cork, 2014 - 2018"),
                    new Paragraph("Appendix: Reference available from Aoife Lynch, Harbour Freight Ltd."),
                ],
            },
        ],
    });
    return new Uint8Array(await Packer.toBuffer(doc));
}
/** Hand-built DOCX containing a text box, which most readers drop. */
export async function makeDocxWithTextBox() {
    const zip = new JSZip();
    zip.file("[Content_Types].xml", '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="xml" ContentType="application/xml"/></Types>');
    zip.file("word/document.xml", `<?xml version="1.0"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006"><w:body>
<w:p><w:r><w:t>Main body paragraph with enough words to be a real line of a CV document for testing purposes only.</w:t></w:r></w:p>
<w:p><w:r><mc:AlternateContent><mc:Choice><w:drawing><w:txbxContent><w:p><w:r><w:t>Sidebar: certified scrum master 2021</w:t></w:r></w:p></w:txbxContent></w:drawing></mc:Choice><mc:Fallback><w:pict><w:txbxContent><w:p><w:r><w:t>Sidebar: certified scrum master 2021</w:t></w:r></w:p></w:txbxContent></w:pict></mc:Fallback></mc:AlternateContent></w:r></w:p>
</w:body></w:document>`);
    return zip.generateAsync({ type: "uint8array" });
}
