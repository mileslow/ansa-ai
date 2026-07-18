import { describe, expect, it, vi } from "vitest";
import { extractBookletDocument } from "../lib/booklet-document-extractor";
import type { LoadedUploadedFile } from "../lib/booklet-types";

describe("booklet document extractor", () => {
  it("labels text uploads as source-document evidence for the model", async () => {
    const parse = vi.fn().mockResolvedValue({
      output_parsed: {
        employer: { name: null, legalName: null, address: null, website: null },
        planYear: { start: null, end: null, label: null },
        eligibility: { waitingPeriod: null, description: null, employeeClasses: [] },
        offeredBenefits: [],
        selectedPlans: [],
        contributions: [],
        contacts: [],
        accounts: [],
        sectionOrder: [],
        templateRole: "none",
        extractionMethod: "email_text",
        warnings: [],
      },
    });
    const file: LoadedUploadedFile = {
      id: "email",
      companyId: "acme",
      fileName: "instructions.eml",
      storagePath: "instructions.eml",
      mimeType: "message/rfc822",
      uploadedAt: "2026-07-17T00:00:00.000Z",
      sha256: "fixture",
      processingStatus: "uploaded",
      data: Buffer.from("Employer: Acme"),
      textContent: "Employer: Acme",
    };
    await extractBookletDocument({
      file,
      classification: {
        fileId: file.id,
        documentType: "email_export",
        confidence: 0.95,
        reasoningSummary: "Email export extension.",
      },
      client: { responses: { parse } } as any,
    });
    const userContent = parse.mock.calls[0][0].input[1].content;
    expect(userContent[0].text).toContain("BEGIN SOURCE DOCUMENT: instructions.eml");
    expect(userContent[0].text).toContain("Employer: Acme");
    expect(userContent[0].text).toContain("END SOURCE DOCUMENT: instructions.eml");
  });
});
