import { describe, expect, it } from "vitest";
import { PDFDocument } from "pdf-lib";
import { optimizePdfForEmailAppendix } from "../lib/pdf-email-optimizer";

describe("email PDF optimizer", () => {
  it("leaves already transport-safe PDFs byte-for-byte unchanged", async () => {
    const pdf = await PDFDocument.create();
    pdf.addPage([612, 792]);
    const source = Buffer.from(await pdf.save());

    const result = await optimizePdfForEmailAppendix(source);

    expect(result).toBe(source);
  });
});
