import fs from "node:fs/promises";
import path from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { runBookletPipeline } from "../lib/booklet-pipeline";
import type {
  BenefitType,
  ClassifiedDocument,
  LoadedUploadedFile,
} from "../lib/booklet-types";
import type { BookletDocumentExtraction } from "../lib/booklet-document-extractor";
import type { ExtractedRequirementCandidate } from "../lib/benefit-requirements/types";
import { writeBookletDocumentScenarios } from "../scripts/generate-booklet-document-scenarios";

const scenarioRoot = path.join(process.cwd(), "test-info", "document-scenarios");
const uploadedAt = "2026-07-20T12:00:00.000Z";

const evidence = (value: string | null, page = 1) =>
  value
    ? {
        value,
        page,
        quote: value,
        confidence: 0.99,
      }
    : null;

async function scenarioFile(
  scenarioId: string,
  fileName: string,
  id = fileName.replace(/[^a-z0-9]+/gi, "-").replace(/^-+|-+$/g, ""),
): Promise<LoadedUploadedFile> {
  const filePath = path.join(scenarioRoot, scenarioId, fileName);
  const data = await fs.readFile(filePath);
  return {
    id,
    companyId: scenarioId,
    fileName,
    storagePath: path.relative(process.cwd(), filePath),
    mimeType: fileName.endsWith(".xlsx")
      ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      : "application/pdf",
    uploadedAt,
    sha256: id,
    processingStatus: "uploaded",
    data,
  };
}

function classification(file: LoadedUploadedFile): ClassifiedDocument {
  if (file.fileName.endsWith(".xlsx"))
    return {
      fileId: file.id,
      documentType: "carrier_rate_sheet",
      confidence: 0.99,
      detectedBenefitTypes: ["medical"],
      detectedPlanYear: "2026",
      reasoningSummary: "Scenario rate workbook",
      benefitTypes: ["medical"],
      documentSubtype: "carrier_rate_sheet",
      scope: "current_employer",
      authority: "rate_or_contribution",
      employerOrGroupId: null,
        planOrProgramIds: [],
        effectiveStart: "2026-01-01",
        effectiveEnd: "2026-12-31",
      };
  if (file.fileName.includes("hsa-account"))
    return {
      fileId: file.id,
      documentType: "plan_summary",
      confidence: 0.99,
      detectedBenefitTypes: ["hsa"],
      detectedPlanYear: "2026",
      reasoningSummary: "Scenario HSA account source",
      benefitTypes: ["hsa"],
      documentSubtype: "hsa_account_summary",
      scope: "current_employer",
      authority: "administrator_material",
      employerOrGroupId: null,
      planOrProgramIds: [],
      effectiveStart: "2026-01-01",
      effectiveEnd: "2026-12-31",
    };
  if (file.fileName.includes("application"))
    return {
      fileId: file.id,
      documentType: "employer_application",
      confidence: 0.99,
      detectedEmployer: "Scenario Employer",
      detectedPlanYear: "2026",
      reasoningSummary: "Completed scenario application",
      benefitTypes: ["medical"],
      documentSubtype: "employer_application",
      scope: "current_employer",
      authority: "employer_selection",
      employerOrGroupId: "Scenario Employer",
      planOrProgramIds: [],
      effectiveStart: "2026-01-01",
      effectiveEnd: "2026-12-31",
    };
  const benefitType = file.fileName.includes("vision")
    ? "vision"
    : file.fileName.includes("dental")
      ? "dental"
      : "medical";
  return {
    fileId: file.id,
    documentType: benefitType === "medical" ? "sbc" : "plan_summary",
    confidence: 0.99,
    detectedBenefitTypes: [benefitType],
    detectedPlanYear: "2026",
    reasoningSummary: `Scenario ${benefitType} plan summary`,
    benefitTypes: [benefitType],
    documentSubtype: `${benefitType}_plan_summary`,
    scope: "current_employer",
    authority: "current_plan_document",
    employerOrGroupId: null,
    planOrProgramIds: [],
    effectiveStart: "2026-01-01",
    effectiveEnd: "2026-12-31",
  };
}

function baseExtraction(
  file: LoadedUploadedFile,
  documentType: ClassifiedDocument["documentType"] = "employer_application",
): BookletDocumentExtraction {
  return {
    fileId: file.id,
    fileName: file.fileName,
    documentType,
    employer: {
      name: null,
      legalName: null,
      address: null,
      website: null,
    },
    planYear: { start: null, end: null, label: null },
    eligibility: { waitingPeriod: null, description: null, employeeClasses: [] },
    offeredBenefits: [],
    selectedPlans: [],
    contributions: [],
    contacts: [],
    accounts: [],
    sectionOrder: [],
    templateRole: "none",
    extractionMethod: "pdf_text",
    warnings: [],
    requirementCandidates: [],
    documentPlanOptions: [],
  };
}

function applicationExtraction({
  file,
  employer,
  offeredBenefits,
  selectedPlans,
  accounts = [],
}: {
  file: LoadedUploadedFile;
  employer: string;
  offeredBenefits: BenefitType[];
  selectedPlans: Array<{ planName: string; benefitType: BenefitType; carrier: string }>;
  accounts?: BookletDocumentExtraction["accounts"];
}): BookletDocumentExtraction {
  return {
    ...baseExtraction(file),
    employer: {
      name: evidence(employer),
      legalName: evidence(employer),
      address: null,
      website: null,
    },
    planYear: {
      start: evidence("2026-01-01"),
      end: evidence("2026-12-31"),
      label: evidence("2026"),
    },
    eligibility: {
      waitingPeriod: evidence("First day of the month after 30 days"),
      description: evidence("Regular full-time employees scheduled for at least 30 hours per week."),
      employeeClasses: [evidence("Full-time employees")!],
    },
    offeredBenefits: offeredBenefits.map((benefitType) => ({
      benefitType,
      offered: true,
      page: 1,
      quote: `${benefitType} checked`,
      confidence: 0.99,
    })),
    selectedPlans: selectedPlans.map((plan) => ({
      ...plan,
      benefitType: plan.benefitType as "medical" | "dental" | "vision" | "life" | "std" | "ltd",
      page: 1,
      quote: plan.planName,
      confidence: 0.99,
    })),
    contacts: [
      {
        role: "Benefits contact",
        name: "Riley Stone",
        organization: employer,
        phone: "208-555-0140",
        email: "benefits@scenario-employer.test",
        website: null,
        page: 1,
        confidence: 0.99,
      },
    ],
    accounts,
    templateRole: "employer_factual",
  };
}

function requirementCandidate({
  file,
  benefitType,
  planName,
  path,
  value,
}: {
  file: LoadedUploadedFile;
  benefitType: BenefitType;
  planName: string;
  path: string;
  value: unknown;
}): ExtractedRequirementCandidate {
  return {
    subjectHint: { benefitType, planOrProgramName: planName },
    path,
    state: "known",
    value,
    rawValue: String(value),
    evidence: {
      sourceFileId: file.id,
      sourceFileName: file.fileName,
      authority: "current_plan_document",
      authorityDomain: path.includes("identity") ? "identity" : "plan_design",
      effectiveStart: "2026-01-01",
      effectiveEnd: "2026-12-31",
      locator: { kind: "pdf", page: 1, quote: String(value) },
      extractionMethod: "text",
      confidence: 0.95,
    },
    confidence: 0.95,
  };
}

function planExtraction(
  file: LoadedUploadedFile,
  benefitType: BenefitType,
  planName: string,
  carrier: string,
): BookletDocumentExtraction {
  return {
    ...baseExtraction(file, benefitType === "medical" ? "sbc" : "plan_summary"),
    documentPlanOptions: [
      {
        benefitType,
        planOrProgramName: planName,
        planOrProgramId: null,
        enrollmentTypes: ["Employee"],
        page: 1,
        quote: planName,
        confidence: 0.99,
      },
    ],
    requirementCandidates: [
      requirementCandidate({
        file,
        benefitType,
        planName,
        path: `plans.${benefitType}.identity.planName`,
        value: planName,
      }),
      requirementCandidate({
        file,
        benefitType,
        planName,
        path: `plans.${benefitType}.identity.carrierOrAdministrator`,
        value: carrier,
      }),
    ],
  };
}

function hsaAccountExtraction(file: LoadedUploadedFile): BookletDocumentExtraction {
  return {
    ...baseExtraction(file, "plan_summary"),
    offeredBenefits: [
      {
        benefitType: "hsa",
        offered: true,
        page: 1,
        quote: "HSA is offered with the HSA-compatible medical plan.",
        confidence: 0.99,
      },
    ],
    accounts: [
      {
        type: "hsa",
        administrator: "Optum Bank",
        page: 1,
        confidence: 0.99,
      },
    ],
  };
}

function medicalPlanAttributes(planName: string, carrier = "Example Health") {
  return {
    file: {} as LoadedUploadedFile,
    classification: {} as ClassifiedDocument,
    attributes: {
      identity: {
        documentType: "Summary of Benefits and Coverage",
        carrier,
        planName,
        planId: null,
        groupName: null,
        coverageStart: "2026-01-01",
        coverageEnd: "2026-12-31",
        coverageFor: "Employee/Family",
        planType: "PPO",
        networkName: "Example Network",
        market: "group",
        state: "ID",
        fundingType: null,
        metalTier: planName.match(/Bronze|Silver|Gold/i)?.[0] || null,
        hsaEligible: /hsa/i.test(planName),
        sourcePages: [1],
      },
      financial: {
        deductible: {
          individual: "$3,000",
          family: "$6,000",
          embeddedIndividual: null,
          period: "plan year",
          raw: "$3,000 individual / $6,000 family",
        },
        familyDeductibleRule: null,
        servicesBeforeDeductible: ["Preventive care"],
        servicesBeforeDeductibleNotes: null,
        specificDeductibles: [],
        specificDeductiblesStatus: "explicit_none",
        outOfPocketLimit: {
          individual: "$7,500",
          family: "$15,000",
          embeddedIndividual: null,
          period: "plan year",
          raw: "$7,500 individual / $15,000 family",
        },
        familyOutOfPocketRule: null,
        excludedFromOutOfPocket: ["Premiums"],
        sourcePages: [1],
      },
      network: {
        usesProviderNetwork: true,
        outOfNetworkCoverage: "Emergency only",
        referralRequired: false,
        referralNotes: null,
        balanceBillingWarning: null,
        emergencyCoverageNotes: "Emergency care covered.",
        providerDirectoryUrl: "https://example-health.test/providers",
        sourcePages: [1],
      },
      contacts: [
        {
          label: "Member services",
          organization: carrier,
          phone: "800-555-0100",
          email: null,
          url: "https://example-health.test",
          purpose: "Member support",
        },
      ],
      services: [
        {
          service: "Primary care",
          medicalEvent: "Primary care",
          inNetwork: [
            {
              networkTier: "in_network",
              cost: "$30 copay",
              deductibleApplies: false,
              notes: null,
            },
          ],
          outOfNetwork: [],
          limitations: null,
          preauthorization: null,
          visitOrUnitLimit: null,
          ageLimit: null,
          rawNotes: null,
          sourcePage: 1,
        },
      ],
      prescriptions: {
        drugListUrl: "https://example-health.test/drugs",
        pharmacyNetworkNotes: null,
        retailSupply: "30 days",
        mailOrderSupply: "90 days",
        priorAuthorizationNotes: null,
        stepTherapyNotes: null,
        specialtyDrugNotes: null,
        tiers: [
          {
            name: "Generic",
            description: null,
            retailCost: "$10",
            mailOrderCost: null,
            outOfNetworkCost: null,
            deductibleApplies: false,
            limitations: null,
            sourcePage: 1,
          },
        ],
        sourcePages: [1],
      },
      exclusions: [],
      otherCoveredServices: [],
      legal: {
        continuationRights: null,
        grievanceAndAppealsRights: null,
        minimumEssentialCoverage: true,
        minimumValueStandard: true,
        marketplaceNotes: null,
        contacts: [],
        sourcePages: [1],
      },
      languageAccess: [],
      coverageExamples: [],
      notices: [],
      extractionWarnings: [],
    },
  };
}

function dependencies(
  extractions: Record<string, BookletDocumentExtraction>,
  medicalNames: Record<string, string>,
) {
  return {
    classify: async (file: LoadedUploadedFile) => classification(file),
    extractDocument: async ({ file }: { file: LoadedUploadedFile }) => extractions[file.id],
    extractPlan: async ({ file, classification }: { file: LoadedUploadedFile; classification: ClassifiedDocument }) => ({
      ...medicalPlanAttributes(medicalNames[file.id] || "Scenario Medical Plan"),
      file,
      classification,
    }),
  };
}

describe("booklet document scenario fixtures", () => {
  beforeAll(async () => {
    await writeBookletDocumentScenarios();
  });

  it("generates the separate scenario folders", async () => {
    await expect(fs.stat(path.join(scenarioRoot, "scenario-catalog.json"))).resolves.toBeTruthy();
    const hsa = await fs.readdir(path.join(scenarioRoot, "01_hsa-selected-no-hsa-form"));
    expect(hsa).toEqual(expect.arrayContaining(["00_completed-employer-application.pdf", "README.md"]));
  });

  it("builds the complete medical and dental package without blockers", async () => {
    const app = await scenarioFile("00_complete-medical-dental", "00_completed-employer-application.pdf", "complete-app");
    const medical = await scenarioFile("00_complete-medical-dental", "01_rochester-your-ppo-option-sbc.pdf", "complete-medical");
    const dental = await scenarioFile("00_complete-medical-dental", "02_delta-dental-basic-family-ppo-plan-i-policy.pdf", "complete-dental");
    const rates = await scenarioFile("00_complete-medical-dental", "03_rates-and-contributions.xlsx", "complete-rates");
    const result = await runBookletPipeline({
      runId: "scenario-complete",
      companyId: "scenario-complete",
      enforceRegistry: false,
      generatePdf: false,
      files: [app, medical, dental, rates],
      dependencies: dependencies(
        {
          [app.id]: applicationExtraction({
            file: app,
            employer: "Scenario Complete Manufacturing LLC",
            offeredBenefits: ["medical", "dental"],
            selectedPlans: [
              { planName: "University of Rochester Your PPO Option", benefitType: "medical", carrier: "Excellus BlueCross BlueShield" },
              { planName: "Delta Dental Basic Family PPO Plan I", benefitType: "dental", carrier: "Delta Dental" },
            ],
          }),
          [medical.id]: planExtraction(medical, "medical", "University of Rochester Your PPO Option", "Excellus BlueCross BlueShield"),
          [dental.id]: planExtraction(dental, "dental", "Delta Dental Basic Family PPO Plan I", "Delta Dental"),
        },
        { [medical.id]: "University of Rochester Your PPO Option" },
      ),
    });
    expect(result.status).toBe("preview");
    expect(result.questions).toEqual([]);
    expect(result.outline?.sections.map((section) => section.id)).toEqual(
      expect.arrayContaining(["medical", "dental"]),
    );
  });

  it("blocks when HSA is checked but no HSA source details are supplied", async () => {
    const app = await scenarioFile("01_hsa-selected-no-hsa-form", "00_completed-employer-application.pdf", "hsa-app");
    const medical = await scenarioFile("01_hsa-selected-no-hsa-form", "01_rochester-your-hsa-eligible-option-sbc.pdf", "hsa-medical");
    const rates = await scenarioFile("01_hsa-selected-no-hsa-form", "02_rates-and-contributions.xlsx", "hsa-rates");
    const result = await runBookletPipeline({
      runId: "scenario-hsa-missing",
      companyId: "scenario-hsa-missing",
      enforceRegistry: false,
      generatePdf: false,
      files: [app, medical, rates],
      dependencies: dependencies(
        {
          [app.id]: applicationExtraction({
            file: app,
            employer: "Scenario HSA Missing LLC",
            offeredBenefits: ["medical", "hsa"],
            selectedPlans: [
              { planName: "University of Rochester Your HSA-Eligible Option", benefitType: "medical", carrier: "Excellus BlueCross BlueShield" },
            ],
          }),
          [medical.id]: planExtraction(medical, "medical", "University of Rochester Your HSA-Eligible Option", "Excellus BlueCross BlueShield"),
        },
        { [medical.id]: "University of Rochester Your HSA-Eligible Option" },
      ),
    });
    expect(result.status).toBe("blocked");
    expect(result.questions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ fieldPath: "accounts.hsa" }),
      ]),
    );

    const hsaSource = await scenarioFile(
      "01_hsa-selected-no-hsa-form",
      "01_hsa-account-source-details/01_scenario-hsa-account-source-details.pdf",
      "hsa-account-source",
    );
    const resolved = await runBookletPipeline({
      runId: "scenario-hsa-resolved",
      companyId: "scenario-hsa-missing",
      enforceRegistry: false,
      generatePdf: false,
      files: [app, medical, rates, hsaSource],
      dependencies: dependencies(
        {
          [app.id]: applicationExtraction({
            file: app,
            employer: "Scenario HSA Missing LLC",
            offeredBenefits: ["medical", "hsa"],
            selectedPlans: [
              { planName: "University of Rochester Your HSA-Eligible Option", benefitType: "medical", carrier: "Excellus BlueCross BlueShield" },
            ],
          }),
          [medical.id]: planExtraction(medical, "medical", "University of Rochester Your HSA-Eligible Option", "Excellus BlueCross BlueShield"),
          [hsaSource.id]: hsaAccountExtraction(hsaSource),
        },
        { [medical.id]: "University of Rochester Your HSA-Eligible Option" },
      ),
    });
    expect(resolved.status).toBe("preview");
    expect(resolved.outline?.sections.map((section) => section.id)).toContain("medical");
    expect(resolved.outline?.sections.map((section) => section.id)).toContain("hsa");
    expect(resolved.benefitsPackage.accounts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: "hsa", administrator: "Optum Bank" }),
      ]),
    );
  });

  it("asks whether an extra unselected vision file should be included", async () => {
    const app = await scenarioFile("02_extra-vision-plan-not-in-application", "00_completed-employer-application.pdf", "vision-app");
    const medical = await scenarioFile("02_extra-vision-plan-not-in-application", "01_kaiser-silver-70-hmo-2500-55-pcp.pdf", "vision-medical");
    const vision = await scenarioFile("02_extra-vision-plan-not-in-application", "02_unselected-eyemed-bright-bold-healthy-options-summary.pdf", "vision-extra");
    const rates = await scenarioFile("02_extra-vision-plan-not-in-application", "03_rates-and-contributions.xlsx", "vision-rates");
    const result = await runBookletPipeline({
      runId: "scenario-extra-vision",
      companyId: "scenario-extra-vision",
      enforceRegistry: false,
      generatePdf: false,
      files: [app, medical, vision, rates],
      dependencies: dependencies(
        {
          [app.id]: applicationExtraction({
            file: app,
            employer: "Scenario Extra Vision LLC",
            offeredBenefits: ["medical"],
            selectedPlans: [
              { planName: "Kaiser Permanente Silver 70 HMO 2500/55", benefitType: "medical", carrier: "Kaiser Permanente" },
            ],
          }),
          [medical.id]: planExtraction(medical, "medical", "Kaiser Permanente Silver 70 HMO 2500/55", "Kaiser Permanente"),
          [vision.id]: planExtraction(vision, "vision", "EyeMed Bright Bold Healthy Options", "EyeMed"),
        },
        { [medical.id]: "Kaiser Permanente Silver 70 HMO 2500/55" },
      ),
    });
    expect(result.status).toBe("blocked");
    expect(result.questions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ fieldPath: "offeredBenefits.vision" }),
      ]),
    );
    const omitted = await runBookletPipeline({
      runId: "scenario-extra-vision-omitted",
      companyId: "scenario-extra-vision",
      enforceRegistry: false,
      generatePdf: false,
      files: [app, medical, vision, rates],
      answers: { "offeredBenefits.vision": false },
      dependencies: dependencies(
        {
          [app.id]: applicationExtraction({
            file: app,
            employer: "Scenario Extra Vision LLC",
            offeredBenefits: ["medical"],
            selectedPlans: [
              { planName: "Kaiser Permanente Silver 70 HMO 2500/55", benefitType: "medical", carrier: "Kaiser Permanente" },
            ],
          }),
          [medical.id]: planExtraction(medical, "medical", "Kaiser Permanente Silver 70 HMO 2500/55", "Kaiser Permanente"),
          [vision.id]: planExtraction(vision, "vision", "EyeMed Bright Bold Healthy Options", "EyeMed"),
        },
        { [medical.id]: "Kaiser Permanente Silver 70 HMO 2500/55" },
      ),
    });
    expect(omitted.status).toBe("preview");
    expect(omitted.outline?.sections.map((section) => section.id)).not.toContain("vision");
  });

  it("asks for selected plans when only the application is present", async () => {
    const app = await scenarioFile("03_application-only-progressive-intake", "00_completed-employer-application.pdf", "application-only-app");
    const first = await runBookletPipeline({
      runId: "scenario-application-only",
      companyId: "scenario-application-only",
      enforceRegistry: false,
      generatePdf: false,
      files: [app],
      dependencies: dependencies(
        {
          [app.id]: applicationExtraction({
            file: app,
            employer: "Scenario Application Only LLC",
            offeredBenefits: [],
            selectedPlans: [],
          }),
        },
        {},
      ),
    });
    expect(first.status).toBe("blocked");
    expect(first.questions.map((question) => question.fieldPath)).toContain("plans.selected");

    const medical = await scenarioFile(
      "03_application-only-progressive-intake",
      "01_selected-medical-plan-source-pack/01_healthfirst-essential-plan-2.pdf",
      "application-only-medical",
    );
    const rates = await scenarioFile(
      "03_application-only-progressive-intake",
      "01_selected-medical-plan-source-pack/02_rates-and-contributions.xlsx",
      "application-only-rates",
    );
    const resumed = await runBookletPipeline({
      runId: "scenario-application-only-resumed",
      companyId: "scenario-application-only",
      enforceRegistry: false,
      generatePdf: false,
      files: [app, medical, rates],
      answers: {
        "plans.selected": [
          { benefitType: "medical", planName: "Healthfirst Essential Plan 2", carrier: "Healthfirst" },
        ],
      },
      dependencies: dependencies(
        {
          [app.id]: applicationExtraction({
            file: app,
            employer: "Scenario Application Only LLC",
            offeredBenefits: [],
            selectedPlans: [],
          }),
          [medical.id]: planExtraction(medical, "medical", "Healthfirst Essential Plan 2", "Healthfirst"),
        },
        { [medical.id]: "Healthfirst Essential Plan 2" },
      ),
    });
    expect(resumed.status).toBe("preview");
    expect(resumed.benefitsPackage.plans[0]).toMatchObject({
      benefitType: "medical",
      name: "Healthfirst Essential Plan 2",
    });
  });

  it("blocks on a spreadsheet plan mismatch instead of choosing the wrong rate", async () => {
    const app = await scenarioFile("04_rate-sheet-plan-mismatch", "00_completed-employer-application.pdf", "mismatch-app");
    const medical = await scenarioFile("04_rate-sheet-plan-mismatch", "01_healthfirst-essential-plan-1.pdf", "mismatch-medical");
    const rates = await scenarioFile("04_rate-sheet-plan-mismatch", "02_mismatched-rates.xlsx", "mismatch-rates");
    const result = await runBookletPipeline({
      runId: "scenario-rate-mismatch",
      companyId: "scenario-rate-mismatch",
      enforceRegistry: false,
      generatePdf: false,
      files: [app, medical, rates],
      dependencies: dependencies(
        {
          [app.id]: applicationExtraction({
            file: app,
            employer: "Scenario Rate Mismatch LLC",
            offeredBenefits: ["medical"],
            selectedPlans: [
              { planName: "Healthfirst Essential Plan 1", benefitType: "medical", carrier: "Healthfirst" },
            ],
          }),
          [medical.id]: planExtraction(medical, "medical", "Healthfirst Essential Plan 1", "Healthfirst"),
        },
        { [medical.id]: "Healthfirst Essential Plan 1" },
      ),
    });
    expect(result.status).toBe("blocked");
    expect(result.benefitsPackage.plans[0].ratePlanId).toBeNull();
    expect(result.questions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ fieldPath: expect.stringMatching(/^plans\..+\.ratePlanId$/) }),
      ]),
    );

    const correctedRates = await scenarioFile(
      "04_rate-sheet-plan-mismatch",
      "01_corrected-rate-workbook/03_corrected-rates-and-contributions.xlsx",
      "mismatch-corrected-rates",
    );
    const resolved = await runBookletPipeline({
      runId: "scenario-rate-mismatch-resolved",
      companyId: "scenario-rate-mismatch",
      enforceRegistry: false,
      generatePdf: false,
      files: [app, medical, rates, correctedRates],
      dependencies: dependencies(
        {
          [app.id]: applicationExtraction({
            file: app,
            employer: "Scenario Rate Mismatch LLC",
            offeredBenefits: ["medical"],
            selectedPlans: [
              { planName: "Healthfirst Essential Plan 1", benefitType: "medical", carrier: "Healthfirst" },
            ],
          }),
          [medical.id]: planExtraction(medical, "medical", "Healthfirst Essential Plan 1", "Healthfirst"),
        },
        { [medical.id]: "Healthfirst Essential Plan 1" },
      ),
    });
    expect(resolved.status).toBe("preview");
    expect(resolved.benefitsPackage.plans[0]).toMatchObject({
      name: "Healthfirst Essential Plan 1",
      ratePlanId: expect.any(String),
    });
  });
});
