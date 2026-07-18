import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { assembleBenefitsPackage } from "../lib/benefits-package-assembler";
import {
  extractBookletDocument,
  type BookletDocumentExtraction,
} from "../lib/booklet-document-extractor";
import {
  generateBenefitsPackagePdf,
  renderBenefitsPackageHtml,
} from "../lib/benefits-booklet-generator";
import { checkBookletQuality } from "../lib/booklet-quality-checker";
import { generateBookletOutline } from "../lib/booklet-outline";
import type {
  BenefitType,
  CarrierRatePlan,
  ContributionRule,
  LoadedUploadedFile,
} from "../lib/booklet-types";
import { classifyDocument } from "../lib/document-classifier";

const live =
  process.env.RUN_LIVE_BOOKLET_PIPELINE_TESTS === "1" &&
  Boolean(process.env.OPENAI_API_KEY);

async function loaded(fileName: string): Promise<LoadedUploadedFile> {
  const data = await fs.readFile(path.join(process.cwd(), "notion-call-transcripts", fileName));
  return {
    id: createHash("sha1").update(fileName).digest("hex").slice(0, 16),
    companyId: "live-input-documents",
    fileName,
    storagePath: `notion-call-transcripts/${fileName}`,
    mimeType: "application/pdf",
    uploadedAt: new Date().toISOString(),
    sha256: createHash("sha256").update(data).digest("hex"),
    processingStatus: "uploaded",
    data,
  };
}

const evidence = (value: string) => ({
  value,
  page: 1,
  quote: value,
  confidence: 0.99,
});

function currentEmployerExtraction(): BookletDocumentExtraction {
  return {
    fileId: "current-employer",
    fileName: "current-employer-instructions.txt",
    documentType: "email_export",
    employer: {
      name: evidence("Input Document Demonstration Company"),
      legalName: null,
      address: null,
      website: null,
    },
    planYear: {
      start: evidence("2026-01-01"),
      end: evidence("2026-12-31"),
      label: evidence("2026"),
    },
    eligibility: {
      waitingPeriod: evidence("First of the month after 30 days"),
      description: evidence(
        "Full-time employees are eligible first of the month after 30 days.",
      ),
      employeeClasses: [evidence("Full-time employees")],
    },
    offeredBenefits: [
      { benefitType: "medical", offered: true, page: 1, quote: "Medical", confidence: 0.99 },
      { benefitType: "dental", offered: true, page: 1, quote: "Dental", confidence: 0.99 },
      { benefitType: "hra", offered: true, page: 1, quote: "HRA", confidence: 0.99 },
      { benefitType: "fsa", offered: true, page: 1, quote: "FSA", confidence: 0.99 },
    ],
    selectedPlans: [
      {
        planName: "Input Medical Plan 2026",
        benefitType: "medical",
        carrier: "Excellus",
        page: 1,
        quote: "Input Medical Plan 2026",
        confidence: 0.99,
      },
      {
        planName: "Input Dental Plan 2026",
        benefitType: "dental",
        carrier: "Excellus",
        page: 1,
        quote: "Input Dental Plan 2026",
        confidence: 0.99,
      },
    ],
    contributions: [],
    contacts: [],
    accounts: [
      { type: "hra", administrator: "HealthEquity", page: 1, confidence: 0.99 },
      { type: "fsa", administrator: "HealthEquity", page: 1, confidence: 0.99 },
    ],
    sectionOrder: [],
    templateRole: "employer_factual",
    extractionMethod: "email_text",
    warnings: [],
  };
}

function rate(planName: string, benefitType: BenefitType): CarrierRatePlan {
  return {
    id: `rate-${benefitType}-${planName}`,
    benefitType,
    carrier: "Excellus",
    effectiveDate: "2026-01-01",
    planName,
    tiers: [
      { tier: "employee", monthlyPremium: benefitType === "dental" ? 45 : 800 },
      { tier: "employee_spouse", monthlyPremium: benefitType === "dental" ? 90 : 1600 },
      { tier: "employee_children", monthlyPremium: benefitType === "dental" ? 80 : 1360 },
      { tier: "family", monthlyPremium: benefitType === "dental" ? 135 : 2250 },
    ],
    sourceFile: "live-input-rates.xlsx",
    sourceFileId: "live-input-rates",
    sourceSheet: "Rates",
    sourceRow: 2,
    confidence: 0.99,
    employerSpecific: true,
  };
}

function contributions(rates: CarrierRatePlan[]): ContributionRule[] {
  return rates.flatMap((plan) =>
    plan.tiers.map((tier) => ({
      benefitType: plan.benefitType,
      planId: plan.id,
      planName: plan.planName,
      tier: tier.tier,
      employeeClass: null,
      mode: "percent" as const,
      value: plan.benefitType === "dental" ? 0.5 : 0.6,
      payPeriods: 26,
      sourceRefs: [],
      confidence: 0.99,
    })),
  );
}

async function writePdf(name: string, pdf: Buffer) {
  const directory = path.resolve("output/pdf/live");
  await fs.mkdir(directory, { recursive: true });
  await fs.writeFile(path.join(directory, name), pdf);
}

function hasValidEvidenceDate(
  field: BookletDocumentExtraction["planYear"]["start"],
) {
  return Boolean(field?.value && !Number.isNaN(new Date(field.value).getTime()));
}

describe.skipIf(!live)("live prior booklet and guide extraction", () => {
  it(
    "finds Flower City dental, HRA/FSA modules and uses the input guide to generate a PDF",
    async () => {
      const file = await loaded("2025 Benefit Guide.pdf");
      const classification = classifyDocument(file);
      const extracted = await extractBookletDocument({ file, classification });
      expect(extracted.sectionOrder.length).toBeGreaterThanOrEqual(10);
      expect(
        extracted.offeredBenefits.some((benefit) => benefit.benefitType === "dental"),
      ).toBe(true);
      expect(
        extracted.offeredBenefits.some((benefit) => benefit.benefitType === "hra") ||
          extracted.accounts.some((account) => account.type === "hra"),
      ).toBe(true);
      expect([
        "master_template",
        "employer_factual",
        "employer_prior_context",
      ]).toContain(extracted.templateRole);

      const current = currentEmployerExtraction();
      // This scenario intentionally reuses the uploaded guide's section order
      // as a template for a different current employer. Preserve the model's
      // extracted facts for the assertions above, then make that scenario role
      // explicit so source-employer plans cannot leak into the new booklet.
      const templateExtraction: BookletDocumentExtraction = {
        ...extracted,
        templateRole: "master_template",
      };
      const rates = [
        rate("Input Medical Plan 2026", "medical"),
        rate("Input Dental Plan 2026", "dental"),
      ];
      const benefitsPackage = assembleBenefitsPackage({
        companyId: "flower-input-derived",
        documentExtractions: [current, templateExtraction],
        rates,
        rateContributions: contributions(rates),
        medicalPlans: [],
      });
      const outline = generateBookletOutline(benefitsPackage);
      expect(outline.sections.map((section) => section.id)).toEqual(
        expect.arrayContaining(["dental", "hra", "fsa"]),
      );
      expect(benefitsPackage.bookletStyle.templateName).toBe("2025 Benefit Guide.pdf");
      const html = renderBenefitsPackageHtml(benefitsPackage, outline);
      const pdf = await generateBenefitsPackagePdf(benefitsPackage, outline);
      const quality = await checkBookletQuality({ benefitsPackage, outline, html, pdf });
      expect(quality.passed).toBe(true);
      await writePdf("flower-city-input-derived-benefits-guide.pdf", pdf);
    },
    600_000,
  );

  it(
    "OCRs Big Tows, finds medical/dental/vision plans, and generates a tailored PDF",
    async () => {
      const file = await loaded("Big Tows Benefit Booklet.pdf");
      const classification = classifyDocument(file);
      const extracted = await extractBookletDocument({ file, classification });
      expect(extracted.extractionMethod).toBe("ocr");
      expect(extracted.employer.name?.value || "").toMatch(/Big Tows/i);
      const foundBenefits = new Set(
        extracted.offeredBenefits
          .filter((benefit) => benefit.offered)
          .map((benefit) => benefit.benefitType),
      );
      expect(foundBenefits.has("medical")).toBe(true);
      expect(foundBenefits.has("dental")).toBe(true);
      expect(foundBenefits.has("vision")).toBe(true);
      const selected = extracted.selectedPlans.filter((plan) =>
        ["medical", "dental", "vision"].includes(plan.benefitType),
      );
      expect(selected.some((plan) => plan.benefitType === "dental")).toBe(true);
      const rates = selected.map((plan) => rate(plan.planName, plan.benefitType));
      const benefitsPackage = assembleBenefitsPackage({
        companyId: "big-tows-input-derived",
        documentExtractions: [extracted],
        rates,
        rateContributions: contributions(rates),
        medicalPlans: [],
        manualAnswers: {
          ...(!hasValidEvidenceDate(extracted.planYear.start)
            ? { "planYear.start": "2026-03-01" }
            : {}),
          ...(!hasValidEvidenceDate(extracted.planYear.end)
            ? { "planYear.end": "2027-02-28" }
            : {}),
          ...(!extracted.eligibility.waitingPeriod
            ? { "eligibility.waitingPeriod": "First of month after 60 days" }
            : {}),
        },
      });
      const outline = generateBookletOutline(benefitsPackage);
      expect(outline.sections.map((section) => section.id)).toEqual(
        expect.arrayContaining(["medical", "dental", "vision"]),
      );
      const html = renderBenefitsPackageHtml(benefitsPackage, outline);
      const pdf = await generateBenefitsPackagePdf(benefitsPackage, outline);
      const quality = await checkBookletQuality({ benefitsPackage, outline, html, pdf });
      expect(quality.passed).toBe(true);
      await writePdf("big-tows-input-derived-benefits-guide.pdf", pdf);
    },
    900_000,
  );
});
