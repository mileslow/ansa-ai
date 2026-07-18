import fs from "node:fs/promises";
import path from "node:path";
import { PDFDocument } from "pdf-lib";
import { describe, expect, it } from "vitest";
import { runBookletPipeline } from "../lib/booklet-pipeline";
import type {
  ClassifiedDocument,
  LoadedUploadedFile,
  PipelineEvent,
} from "../lib/booklet-types";
import { calculateContribution } from "../lib/contribution-engine";
import { classifyDocument } from "../lib/document-classifier";
import { extractRateSheet } from "../lib/rate-sheet-extractor";

const fixturePath = path.join(
  process.cwd(),
  "notion-call-transcripts",
  "ER and EE cost per month spreadsheet.xlsx",
);

async function rateFile(): Promise<LoadedUploadedFile> {
  return {
    id: "rates",
    companyId: "big-tows",
    fileName: path.basename(fixturePath),
    storagePath: fixturePath,
    mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    uploadedAt: "2026-07-17T00:00:00.000Z",
    sha256: "fixture",
    processingStatus: "uploaded",
    data: await fs.readFile(fixturePath),
  };
}

const employerFile: LoadedUploadedFile = {
  id: "employer",
  companyId: "big-tows",
  fileName: "filled-employer-application.pdf",
  storagePath: "fixtures/filled-employer-application.pdf",
  mimeType: "application/pdf",
  uploadedAt: "2026-07-17T00:00:00.000Z",
  sha256: "fixture-employer",
  processingStatus: "uploaded",
  data: Buffer.from("synthetic fixture"),
};

function classification(file: LoadedUploadedFile): ClassifiedDocument {
  return file.id === "employer"
    ? {
        fileId: file.id,
        documentType: "employer_application",
        confidence: 0.99,
        detectedEmployer: "Big Tows Inc",
        detectedCarrier: "Excellus",
        detectedPlanYear: "2026",
        reasoningSummary: "Test fixture",
      }
    : classifyDocument(file);
}

function employerExtraction(waitingPeriod: string | null) {
  const evidence = (value: string) => ({
    value,
    page: 1,
    quote: value,
    confidence: 0.99,
  });
  return {
    fileId: employerFile.id,
    fileName: employerFile.fileName,
    documentType: "employer_application" as const,
    employer: {
      name: evidence("Big Tows Inc"),
      legalName: evidence("Big Tows Inc"),
      address: null,
      website: null,
    },
    planYear: {
      start: evidence("2026-01-01"),
      end: evidence("2026-12-31"),
      label: evidence("2026"),
    },
    eligibility: {
      waitingPeriod: waitingPeriod ? evidence(waitingPeriod) : null,
      description: waitingPeriod ? evidence(waitingPeriod) : null,
      employeeClasses: [evidence("Full-time employees")],
    },
    offeredBenefits: [
      {
        benefitType: "medical" as const,
        offered: true,
        page: 1,
        quote: "Medical",
        confidence: 0.99,
      },
    ],
    selectedPlans: [
      {
        planName: "Healthy NY 2026",
        benefitType: "medical" as const,
        carrier: "Excellus",
        page: 1,
        quote: "Healthy NY 2026",
        confidence: 0.99,
      },
    ],
    contributions: [],
    contacts: [],
    accounts: [],
    sectionOrder: [],
    templateRole: "employer_factual" as const,
    extractionMethod: "pdf_text" as const,
    warnings: [],
  };
}

async function sixPagePdf() {
  const pdf = await PDFDocument.create();
  for (let index = 0; index < 6; index += 1) pdf.addPage([612, 792]);
  return Buffer.from(await pdf.save());
}

describe("booklet agent pipeline", () => {
  it("classifies and parses the supplied contribution workbook", async () => {
    const file = await rateFile();
    expect(classifyDocument(file).documentType).toBe("renewal_spreadsheet");
    const extraction = extractRateSheet(file);
    const healthyNy = extraction.plans.find((plan) => plan.planName === "Healthy NY 2026");
    expect(healthyNy?.tiers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ tier: "employee", monthlyPremium: 719.68 }),
        expect.objectContaining({ tier: "family", monthlyPremium: 2051.09 }),
      ]),
    );
    expect(
      extraction.contributions.find(
        (rule) => rule.planName === "Healthy NY 2026" && rule.tier === "employee",
      ),
    ).toMatchObject({ mode: "percent", value: 0.5, payPeriods: 52 });
  });

  it("calculates percent, monthly-flat, and per-pay contributions", () => {
    const base = {
      benefitType: "medical" as const,
      tier: "employee",
      payPeriods: 26,
      sourceRefs: [],
    };
    expect(calculateContribution(1000, { ...base, mode: "percent", value: 0.6 })).toMatchObject({
      employerMonthly: 600,
      employeeMonthly: 400,
      employeePerPay: 184.62,
    });
    expect(calculateContribution(1000, { ...base, mode: "flat_monthly", value: 450 })).toMatchObject({
      employerMonthly: 450,
      employeeMonthly: 550,
    });
    expect(calculateContribution(1000, { ...base, mode: "flat_per_pay", value: 200 })).toMatchObject({
      employerMonthly: 433.33,
      employerPerPay: 200,
    });
  });

  it("asks one specific blocker, resumes from the answer, and completes every stage", async () => {
    const file = await rateFile();
    const dependencies = {
      classify: async (input: LoadedUploadedFile) => classification(input),
      extractDocument: async () => employerExtraction(null),
      renderPdf: async () => sixPagePdf(),
    };
    const firstEvents: PipelineEvent[] = [];
    const blocked = await runBookletPipeline({
      runId: "run-blocked",
      companyId: "big-tows",
      files: [employerFile, file],
      dependencies,
      onEvent: (event) => void firstEvents.push(event),
    });
    expect(blocked.status).toBe("blocked");
    expect(blocked.questions.map((question) => question.fieldPath)).toEqual([
      "eligibility.waitingPeriod",
    ]);

    const resumedEvents: PipelineEvent[] = [];
    const complete = await runBookletPipeline({
      runId: "run-resumed",
      companyId: "big-tows",
      files: [employerFile, file],
      answers: { "eligibility.waitingPeriod": "First of the month after 60 days" },
      dependencies,
      onEvent: (event) => void resumedEvents.push(event),
    });
    expect(complete.status).toBe("complete");
    const matchedRate = complete.benefitsPackage.rates.find(
      (rate) => rate.id === complete.benefitsPackage.plans[0]?.ratePlanId,
    );
    expect(matchedRate?.planName).toBe("Healthy NY 2026");
    expect(complete.benefitsPackage.confidenceReport.manualAnswers).toContain(
      "eligibility.waitingPeriod",
    );
    expect(complete.outline?.sections.map((section) => section.id)).toEqual(
      expect.arrayContaining(["cover", "medical", "contacts", "legal"]),
    );
    for (const event of [...firstEvents, ...resumedEvents])
      expect(Object.values(event)).not.toContain(undefined);
    expect(
      resumedEvents.find(
        (event) => event.stage === "Classifying documents" && event.status === "started",
      ),
    ).not.toHaveProperty("details");
    expect(
      resumedEvents.find(
        (event) => event.stage === "Uploading files" && event.status === "complete",
      ),
    ).toHaveProperty("details");
    expect(new Set(resumedEvents.map((event) => event.stage))).toEqual(
      new Set([
        "Uploading files",
        "Classifying documents",
        "Extracting employer setup",
        "Reading carrier rate sheets",
        "Parsing plan documents",
        "Reading prior booklets/guides",
        "Matching rates to plans",
        "Detecting offered benefits",
        "Resolving conflicts",
        "Building booklet outline",
        "Writing booklet content",
        "Running quality checks",
        "Rendering PDF",
        "Complete",
      ]),
    );
  });

  it("runs the grounded content agent result through the completed pipeline", async () => {
    const file = await rateFile();
    const writeContent = async () => ({
      variant: "test",
      model: "mock-content-model",
      sections: [
        {
          id: "welcome" as const,
          title: "Welcome",
          status: "ready" as const,
          missingFields: [],
          sourcePaths: ["employer.name"],
          copy: "Welcome to Big Tows Inc benefits.",
        },
      ],
    });
    const result = await runBookletPipeline({
      runId: "run-content-agent",
      companyId: "big-tows",
      files: [employerFile, file],
      answers: { "eligibility.waitingPeriod": "First of the month after 60 days" },
      dependencies: {
        classify: async (input: LoadedUploadedFile) => classification(input),
        extractDocument: async () => employerExtraction(null),
        writeContent,
        renderPdf: async () => sixPagePdf(),
      },
    });
    expect(result.status).toBe("complete");
    expect(result.content).toMatchObject({
      model: "mock-content-model",
      sections: [expect.objectContaining({ id: "welcome", status: "ready" })],
    });
    expect(result.html).toContain("Welcome to Big Tows Inc benefits.");
  });
});
