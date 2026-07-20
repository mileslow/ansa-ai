import { describe, expect, it } from "vitest";
import { PDFDocument } from "pdf-lib";
import { appendAuthoritativeSourceBooklet } from "../lib/booklet-source-appendix";
import type { ClassifiedDocument, LoadedUploadedFile } from "../lib/booklet-types";

async function pdfWithPages(count: number) {
  const pdf = await PDFDocument.create();
  for (let page = 0; page < count; page += 1) pdf.addPage([612, 792]);
  return Buffer.from(await pdf.save());
}

describe("authoritative source booklet appendix", () => {
  it("preserves every page of a sole authoritative booklet in email mode", async () => {
    const generatedPdf = await pdfWithPages(2);
    const sourcePdf = await pdfWithPages(3);
    const source = {
      id: "source",
      fileName: "Big Tows Benefit Booklet.pdf",
      mimeType: "application/pdf",
      data: sourcePdf,
    } as LoadedUploadedFile;
    const classification = {
      fileId: "source",
      documentType: "benefit_guide",
      confidence: 0.99,
      reasoningSummary: "Existing authoritative booklet",
    } as ClassifiedDocument;

    const merged = await appendAuthoritativeSourceBooklet({
      generatedPdf,
      files: [source],
      classifications: [classification],
      enabled: true,
    });

    expect((await PDFDocument.load(merged)).getPageCount()).toBe(6);
  });

  it("does not append a source booklet in strict studio mode", async () => {
    const generatedPdf = await pdfWithPages(2);
    const result = await appendAuthoritativeSourceBooklet({
      generatedPdf,
      files: [],
      classifications: [],
      enabled: false,
    });
    expect(result).toEqual(generatedPdf);
  });
});
