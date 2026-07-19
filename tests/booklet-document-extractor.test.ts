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
        offeredBenefits: [
          {
            benefitType: "dental",
            offered: true,
            page: 1,
            quote: "Dental coverage",
            confidence: 0.95,
          },
        ],
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
    const result = await extractBookletDocument({
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
    expect(result.offeredBenefits).toEqual([
      expect.objectContaining({ benefitType: "dental", offered: true }),
    ]);
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

  it("does not turn plan-design evidence into employer offering or selection", async () => {
    const requirementCandidate = (path: string, value: string | boolean) => ({
      benefitType: "medical" as const,
      planOrProgramName: "Bronze HDHP",
      planOrProgramId: "bronze-hdhp",
      path,
      state: "known" as const,
      value,
      valueJson: null,
      rawValue: String(value),
      reasonCode: null,
      page: 1,
      quote: String(value),
      confidence: 0.99,
    });
    const parse = vi
      .fn()
      .mockResolvedValueOnce({
        output_parsed: { documentPlanOptions: [] },
      })
      .mockResolvedValueOnce({
        output_parsed: {
          employer: {
            name: null,
            legalName: null,
            address: {
              value: "1 Carrier Plaza",
              page: 1,
              quote: "1 Carrier Plaza",
              confidence: 0.99,
            },
            website: null,
          },
          planYear: {
            start: {
              value: "January 1 to December 31 (implicit)",
              page: 1,
              quote: "once per year starting January 1",
              confidence: 0.7,
            },
            end: null,
            label: null,
          },
          eligibility: {
            waitingPeriod: null,
            description: null,
            employeeClasses: [],
          },
          offeredBenefits: [
            {
              benefitType: "medical",
              offered: true,
              page: 1,
              quote: "Bronze HDHP",
              confidence: 0.99,
            },
          ],
          selectedPlans: [
            {
              planName: "Bronze HDHP",
              benefitType: "medical",
              carrier: "Example Carrier",
              page: 1,
              quote: "Bronze HDHP",
              confidence: 0.99,
            },
          ],
          contributions: [
            {
              benefitType: "medical",
              planName: "Bronze HDHP",
              tier: "employee",
              employeeClass: null,
              mode: "percent",
              value: 50,
              payPeriods: 26,
              page: 1,
              quote: "50% coinsurance",
              confidence: 0.8,
            },
          ],
          contacts: [],
          accounts: [],
          sectionOrder: [],
          templateRole: "none",
          extractionMethod: "pdf_text",
          warnings: [],
          requirementCandidates: [
            requirementCandidate(
              "plans.medical.offering.selectedByEmployer",
              true,
            ),
            requirementCandidate(
              "plans.medical.identity.planName",
              "Bronze HDHP",
            ),
            requirementCandidate("plans.medical.rates.employeeCost", 0),
          ],
        },
      });
    const file: LoadedUploadedFile = {
      id: "plan-document",
      companyId: "acme",
      fileName: "bronze-hdhp-sbc.pdf",
      storagePath: "bronze-hdhp-sbc.pdf",
      mimeType: "application/pdf",
      uploadedAt: "2026-07-18T00:00:00.000Z",
      sha256: "fixture",
      processingStatus: "uploaded",
      data: Buffer.from("pdf fixture"),
    };
    const result = await extractBookletDocument({
      file,
      classification: {
        fileId: file.id,
        documentType: "sbc",
        confidence: 0.99,
        reasoningSummary: "Medical plan design document.",
        benefitTypes: ["medical"],
        documentSubtype: "sbc",
        scope: "unknown",
        authority: "current_plan_document",
      },
      client: { responses: { parse } } as any,
    });
    expect(result.offeredBenefits).toEqual([]);
    expect(result.employer.address).toBeNull();
    expect(result.planYear.start).toBeNull();
    expect(result.selectedPlans).toEqual([]);
    expect(result.contributions).toEqual([]);
    expect(result.requirementCandidates).toEqual([
      expect.objectContaining({ path: "plans.medical.identity.planName" }),
    ]);
    expect(result.warnings).toEqual([
      expect.stringContaining("current_plan_document is not accepted authority"),
      expect.stringContaining("a zero employee cost needs an explicit no-cost"),
      expect.stringContaining("Rejected employer address from a plan document"),
      expect.stringContaining("Rejected 1 plan-year date field"),
      expect.stringContaining("Rejected 3 legacy summary fact(s)"),
    ]);
  });

  it("uses the focused option index to split a generic dental extraction", async () => {
    const enrollmentTypes = ["Self Only", "Self Plus One", "Self and Family"];
    const optionQuote =
      "High Option - Self Only; High Option - Self Plus One; High Option - Self and Family; Standard Option - Self Only; Standard Option - Self Plus One; Standard Option - Self and Family";
    const option = (name: string) => ({
      benefitType: "dental" as const,
      planOrProgramName: `MetLife Federal Dental Plan ${name} Option`,
      planOrProgramId: "02AP-11",
      enrollmentTypes,
      page: 1,
      quote: optionQuote,
      confidence: 0.99,
    });
    const requirementCandidate = (path: string, value: string) => ({
      benefitType: "dental" as const,
      planOrProgramName: "MetLife Federal Dental Plan",
      planOrProgramId: null,
      path,
      state: "known" as const,
      value,
      valueJson: null,
      rawValue: value,
      reasonCode: null,
      page: 1,
      quote: value,
      confidence: 0.98,
    });
    const parse = vi
      .fn()
      .mockResolvedValueOnce({
        output_parsed: {
          documentPlanOptions: [option("High"), option("Standard")],
        },
      })
      .mockResolvedValueOnce({
        output_parsed: {
          employer: { name: null, legalName: null, address: null, website: null },
          planYear: { start: null, end: null, label: null },
          eligibility: {
            waitingPeriod: null,
            description: null,
            employeeClasses: [],
          },
          offeredBenefits: [],
          selectedPlans: [],
          contributions: [],
          contacts: [],
          accounts: [],
          sectionOrder: [],
          templateRole: "none",
          extractionMethod: "pdf_text",
          warnings: [],
          documentPlanOptions: [],
          requirementCandidates: [
            requirementCandidate(
              "plans.dental.identity.planName",
              "MetLife Federal Dental Plan",
            ),
            requirementCandidate("plans.dental.identity.planDesign", "PPO"),
          ],
        },
      });
    const file: LoadedUploadedFile = {
      id: "metlife-dental-options",
      companyId: "fedvip",
      fileName: "metlife-fedvip-dental.pdf",
      storagePath: "metlife-fedvip-dental.pdf",
      mimeType: "application/pdf",
      uploadedAt: "2026-07-18T00:00:00.000Z",
      sha256: "fixture",
      processingStatus: "uploaded",
      data: Buffer.from("pdf fixture"),
    };
    const result = await extractBookletDocument({
      file,
      classification: {
        fileId: file.id,
        documentType: "benefit_guide",
        confidence: 0.99,
        reasoningSummary: "FEDVIP dental plan brochure.",
        benefitTypes: ["dental"],
        documentSubtype: "official plan brochure",
        scope: "generic_reference",
        authority: "current_plan_document",
      },
      client: { responses: { parse } } as any,
    });

    expect(result.documentPlanOptions).toEqual([
      expect.objectContaining({
        planOrProgramName: "MetLife Federal Dental Plan High Option",
        enrollmentTypes,
      }),
      expect.objectContaining({
        planOrProgramName: "MetLife Federal Dental Plan Standard Option",
        enrollmentTypes,
      }),
    ]);
    const candidates = result.requirementCandidates || [];
    const identities = candidates.filter(
      (candidate) => candidate.path === "plans.dental.identity.planName",
    );
    expect(identities.map((candidate) => candidate.value)).toEqual([
      "MetLife Federal Dental Plan High Option",
      "MetLife Federal Dental Plan Standard Option",
    ]);
    expect(
      candidates
        .filter(
          (candidate) => candidate.path === "plans.dental.identity.planDesign",
        )
        .map((candidate) => candidate.subjectHint.planOrProgramName),
    ).toEqual([
      "MetLife Federal Dental Plan High Option",
      "MetLife Federal Dental Plan Standard Option",
    ]);
    expect(
      candidates.some(
        (candidate) =>
          candidate.subjectHint.planOrProgramName ===
          "MetLife Federal Dental Plan",
      ),
    ).toBe(false);
    expect(
      candidates.every(
        (candidate) => candidate.subjectHint.planOrProgramId === undefined,
      ),
    ).toBe(true);
  });

  it("lets complete multi-page vision schedules supersede incomplete output", async () => {
    const rawCandidate = (
      path: string,
      value: string | number,
      quote: string,
    ) => ({
      benefitType: "vision" as const,
      planOrProgramName: "EyeMed",
      planOrProgramId: null,
      path,
      state: "known" as const,
      value,
      valueJson: null,
      rawValue: String(value),
      reasonCode: null,
      page: 1,
      quote,
      confidence: 0.9,
    });
    const parse = vi
      .fn()
      .mockResolvedValueOnce({
        output_parsed: {
          documentPlanOptions: [
            {
              benefitType: "vision",
              planOrProgramName: "EyeMed",
              planOrProgramId: null,
              enrollmentTypes: [],
              page: 1,
              quote: "EyeMed",
              confidence: 0.99,
            },
          ],
        },
      })
      .mockResolvedValueOnce({
        output_parsed: {
          candidates: [
            {
              planOrProgramName: "EyeMed",
              path: "plans.vision.exam.schedule",
              valueJson: JSON.stringify({
                adults19Plus: { inNetwork: "$0", outOfNetwork: "$84" },
                childrenUnder19: { inNetwork: "$0", outOfNetwork: "$90" },
              }),
              rawValue: "Adults $0 ($84); children $0 ($90)",
              evidenceSegments: [
                { page: 1, quote: "Routine eye exam $0 ($84)" },
                { page: 2, quote: "Routine eye exam $0 ($90)" },
              ],
              confidence: 0.99,
            },
            {
              planOrProgramName: "EyeMed",
              path: "plans.vision.contacts.electiveSchedule",
              valueJson: JSON.stringify({
                adults19Plus: { allowance: "$200", fittingFee: "up to $55" },
                childrenUnder19: { allowance: "$300", fittingFee: "up to $65" },
              }),
              rawValue: "Adults $200 and fitting up to $55; children $300 and fitting up to $65",
              evidenceSegments: [
                { page: 2, quote: "Up to $55" },
                { page: 3, quote: "Premium: up to $65" },
              ],
              confidence: 0.98,
            },
          ],
        },
      })
      .mockResolvedValueOnce({
        output_parsed: {
          employer: { name: null, legalName: null, address: null, website: null },
          planYear: { start: null, end: null, label: null },
          eligibility: {
            waitingPeriod: null,
            description: null,
            employeeClasses: [],
          },
          offeredBenefits: [],
          selectedPlans: [],
          contributions: [],
          contacts: [],
          accounts: [],
          sectionOrder: [],
          templateRole: "none",
          extractionMethod: "pdf_text",
          warnings: [],
          documentPlanOptions: [],
          requirementCandidates: [
            rawCandidate(
              "plans.vision.exam.schedule",
              "Adults only: $0 ($84)",
              "Routine eye exam $0 ($84)",
            ),
            rawCandidate(
              "plans.vision.rates.employeeCost",
              0,
              "The employer pays a portion of the premium.",
            ),
          ],
        },
      });
    const file: LoadedUploadedFile = {
      id: "vision-comparison",
      companyId: "pebb",
      fileName: "vision-comparison.pdf",
      storagePath: "vision-comparison.pdf",
      mimeType: "application/pdf",
      uploadedAt: "2026-07-18T00:00:00.000Z",
      sha256: "fixture",
      processingStatus: "uploaded",
      data: Buffer.from("pdf fixture"),
    };
    const result = await extractBookletDocument({
      file,
      classification: {
        fileId: file.id,
        documentType: "benefit_guide",
        confidence: 0.99,
        reasoningSummary: "Official vision comparison.",
        benefitTypes: ["vision"],
        documentSubtype: "vision benefits comparison",
        scope: "current_employer",
        authority: "administrator_material",
      },
      client: { responses: { parse } } as any,
    });

    const candidates = result.requirementCandidates || [];
    const exam = candidates.find(
      (candidate) => candidate.path === "plans.vision.exam.schedule",
    );
    expect(exam?.value).toEqual({
      adults19Plus: { inNetwork: "$0", outOfNetwork: "$84" },
      childrenUnder19: { inNetwork: "$0", outOfNetwork: "$90" },
    });
    expect(exam?.evidence.locator).toEqual(
      expect.objectContaining({ kind: "pdf", page: 1 }),
    );
    expect(exam?.supportingEvidence).toEqual([
      expect.objectContaining({
        locator: expect.objectContaining({ kind: "pdf", page: 2 }),
      }),
    ]);
    const contacts = candidates.find(
      (candidate) =>
        candidate.path === "plans.vision.contacts.electiveSchedule",
    );
    expect(contacts?.supportingEvidence).toEqual([
      expect.objectContaining({
        locator: expect.objectContaining({ kind: "pdf", page: 3 }),
      }),
    ]);
    expect(
      candidates.some(
        (candidate) => candidate.path === "plans.vision.rates.employeeCost",
      ),
    ).toBe(false);
    expect(result.warnings).toEqual([
      expect.stringContaining("a zero employee cost needs an explicit no-cost"),
    ]);
  });

  it("repairs a missing cell in a multi-plan vision comparison", async () => {
    const optionNames = [
      "Davis Vision by MetLife",
      "EyeMed",
      "MetLife Vision",
    ];
    const schedulePaths = [
      "plans.vision.exam.schedule",
      "plans.vision.lenses.standardSchedule",
      "plans.vision.frames.schedule",
      "plans.vision.contacts.electiveSchedule",
      "plans.vision.contacts.necessarySchedule",
      "plans.vision.network.outOfNetworkSchedule",
      "plans.vision.lenses.enhancements",
    ];
    const scheduleCandidate = (planOrProgramName: string, path: string) => ({
      planOrProgramName,
      path,
      valueJson: JSON.stringify({
        adults19Plus: { memberCost: "$0" },
        childrenUnder19: { memberCost: "$0" },
      }),
      rawValue: "Adults $0; children $0",
      evidenceSegments: [
        { page: 1, quote: `${planOrProgramName} adults $0` },
        { page: 2, quote: `${planOrProgramName} children $0` },
      ],
      confidence: 0.98,
    });
    const initialCandidates = optionNames.flatMap((planOrProgramName) =>
      schedulePaths
        .filter(
          (path) =>
            !(
              planOrProgramName === "Davis Vision by MetLife" &&
              path === "plans.vision.contacts.necessarySchedule"
            ),
        )
        .map((path) => scheduleCandidate(planOrProgramName, path)),
    );
    const documentPlanOptions = optionNames.map((planOrProgramName) => ({
      benefitType: "vision" as const,
      planOrProgramName,
      planOrProgramId: null,
      enrollmentTypes: [],
      page: 1,
      quote: planOrProgramName,
      confidence: 0.99,
    }));
    const parse = vi
      .fn()
      .mockResolvedValueOnce({
        output_parsed: { documentPlanOptions },
      })
      .mockResolvedValueOnce({
        output_parsed: { candidates: initialCandidates },
      })
      .mockResolvedValueOnce({
        output_parsed: {
          candidates: [
            {
              planOrProgramName: "Davis Vision by MetLife",
              path: "plans.vision.contacts.necessarySchedule",
              valueJson: JSON.stringify({
                adults19Plus: {
                  memberCost: "$0",
                  outOfNetworkReimbursement: "$225",
                },
                childrenUnder19: {
                  memberCost: "$0",
                  outOfNetworkReimbursement: "$225",
                },
              }),
              rawValue:
                "Adults medically necessary $0 ($225); children medically necessary $0 ($225)",
              evidenceSegments: [
                { page: 2, quote: "Medically necessary $0 ($225)" },
                { page: 3, quote: "Medically necessary $0 ($225)" },
              ],
              confidence: 0.99,
            },
          ],
        },
      })
      .mockResolvedValueOnce({
        output_parsed: {
          employer: { name: null, legalName: null, address: null, website: null },
          planYear: { start: null, end: null, label: null },
          eligibility: {
            waitingPeriod: null,
            description: null,
            employeeClasses: [],
          },
          offeredBenefits: [],
          selectedPlans: [],
          contributions: [],
          contacts: [],
          accounts: [],
          sectionOrder: [],
          templateRole: "none",
          extractionMethod: "pdf_text",
          warnings: [],
          documentPlanOptions: [],
          requirementCandidates: [],
        },
      });
    const file: LoadedUploadedFile = {
      id: "vision-comparison-repair",
      companyId: "pebb",
      fileName: "benefits-comparison.pdf",
      storagePath: "benefits-comparison.pdf",
      mimeType: "application/pdf",
      uploadedAt: "2026-07-18T00:00:00.000Z",
      sha256: "fixture",
      processingStatus: "uploaded",
      data: Buffer.from("pdf fixture"),
    };
    const result = await extractBookletDocument({
      file,
      classification: {
        fileId: file.id,
        documentType: "benefit_guide",
        confidence: 0.99,
        reasoningSummary: "Official vision comparison.",
        benefitTypes: ["vision"],
        documentSubtype: "vision benefits comparison",
        scope: "current_employer",
        authority: "administrator_material",
      },
      client: { responses: { parse } } as any,
    });

    expect(parse).toHaveBeenCalledTimes(4);
    expect(parse.mock.calls[2][0].input[1].content[1].text).toContain(
      '"planOrProgramName":"Davis Vision by MetLife","path":"plans.vision.contacts.necessarySchedule"',
    );
    const repaired = (result.requirementCandidates || []).find(
      (candidate) =>
        candidate.subjectHint.planOrProgramName ===
          "Davis Vision by MetLife" &&
        candidate.path === "plans.vision.contacts.necessarySchedule",
    );
    expect(repaired?.value).toEqual({
      adults19Plus: {
        memberCost: "$0",
        outOfNetworkReimbursement: "$225",
      },
      childrenUnder19: {
        memberCost: "$0",
        outOfNetworkReimbursement: "$225",
      },
    });
    expect(repaired?.supportingEvidence).toEqual([
      expect.objectContaining({
        locator: expect.objectContaining({ kind: "pdf", page: 3 }),
      }),
    ]);
  });
});
