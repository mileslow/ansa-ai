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
    const responseFormat = parse.mock.calls[0][0].text.format;
    expect(JSON.stringify(responseFormat)).not.toContain('"propertyNames"');
    const userContent = parse.mock.calls[0][0].input[1].content;
    expect(userContent[0].text).toContain("BEGIN SOURCE DOCUMENT: instructions.eml");
    expect(userContent[0].text).toContain("Employer: Acme");
    expect(userContent[0].text).toContain("END SOURCE DOCUMENT: instructions.eml");
  });

  it("keeps only candidates allowed by the classified benefit contract", async () => {
    const candidate = (benefitType: "medical" | "hsa", path: string) => ({
      benefitType,
      planOrProgramName: "Fixture plan",
      planOrProgramId: "fixture-plan",
      path,
      state: "known",
      value: true,
      valueJson: null,
      rawValue: "true",
      reasonCode: null,
      page: null,
      quote: "The employer selected this plan.",
      confidence: 0.99,
    });
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
        requirementCandidates: [
          candidate("medical", "plans.medical.offering.selectedByEmployer"),
          candidate("medical", "plans.medical.invented.modelPath"),
          candidate("hsa", "hsa.offering.confirmed"),
        ],
      },
    });
    const sourceText = "The employer selected this plan.";
    const file: LoadedUploadedFile = {
      id: "selection-email",
      companyId: "acme",
      fileName: "selection.eml",
      storagePath: "selection.eml",
      mimeType: "message/rfc822",
      uploadedAt: "2026-07-17T00:00:00.000Z",
      sha256: "fixture",
      processingStatus: "uploaded",
      data: Buffer.from(sourceText),
      textContent: sourceText,
    };
    const result = await extractBookletDocument({
      file,
      classification: {
        fileId: file.id,
        documentType: "email_export",
        confidence: 0.99,
        reasoningSummary: "Medical selection email.",
        benefitTypes: ["medical"],
        documentSubtype: "employer_selection",
        scope: "current_employer",
        authority: "employer_selection",
      },
      client: { responses: { parse } } as any,
    });
    expect(result.requirementCandidates).toEqual([
      expect.objectContaining({
        path: "plans.medical.offering.selectedByEmployer",
        evidence: expect.objectContaining({
          locator: expect.objectContaining({ kind: "text", start: 0 }),
        }),
      }),
    ]);
    expect(result.warnings).toEqual([
      expect.stringContaining("plans.medical.invented.modelPath"),
      expect.stringContaining("hsa is outside this document's classified benefit focus"),
    ]);
  });
});
