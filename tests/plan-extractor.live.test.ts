import fs from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { assembleBenefitsPackage } from "../lib/benefits-package-assembler";
import type { BookletDocumentExtraction } from "../lib/booklet-document-extractor";
import {
  generateBenefitsPackagePdf,
  renderBenefitsPackageHtml,
} from "../lib/benefits-booklet-generator";
import { checkBookletQuality } from "../lib/booklet-quality-checker";
import { generateBookletOutline } from "../lib/booklet-outline";
import { extractMedicalPlan, type PlanPatch } from "../lib/plan-extractor";

const live = process.env.RUN_LIVE_PLAN_TESTS === "1" && !!process.env.OPENAI_API_KEY;
const fixtures = [
  { file: "uhc-bronze-2026.pdf", carrier: /United|UHC/i, plan: /METRO|BRONZE/i, planId: /NY_SB_2026/i },
  { file: "cigna-silver-2026.pdf", carrier: /Cigna/i, plan: /Silver|Partnered/i },
  { file: "aetna-silver-2025.pdf", carrier: /Aetna/i, plan: /Silver/i },
];

const evidence = (value: string) => ({
  value,
  page: 1,
  quote: value,
  confidence: 0.99,
});

describe.skipIf(!live)("live medical plan extraction", () => {
  for (const fixture of fixtures) {
    it(`extracts the complete schema from ${fixture.file}`, async () => {
      const patches: PlanPatch[] = [], pages: Array<{ pageNumber: number; text: string }> = [];
      const file = await fs.readFile(path.join(process.cwd(), "tests/fixtures/plans", fixture.file));
      const attributes = await extractMedicalPlan({
        apiKey: process.env.OPENAI_API_KEY, file, fileName: fixture.file, progressIntervalMs: 0,
        store: { updatePlan: async (patch) => void patches.push(patch), writeTextPage: async (page) => void pages.push(page) },
      });
      expect(attributes.identity.carrier || "").toMatch(fixture.carrier);
      expect(attributes.identity.planName).toMatch(fixture.plan);
      if (fixture.planId) expect(attributes.identity.planId || "").toMatch(fixture.planId);
      expect(attributes.services.length).toBeGreaterThanOrEqual(20);
      expect(attributes.financial.deductible.raw.length).toBeGreaterThan(0);
      expect(attributes.coverageExamples.length).toBeGreaterThanOrEqual(3);
      expect(pages.length).toBeGreaterThanOrEqual(6);
      expect(patches.at(-1)).toMatchObject({ status: "complete", parsingPct: 100 });
      const employer = `Live ${attributes.identity.carrier || "Carrier"} Fixture`;
      const year =
        attributes.identity.coverageStart?.match(/20\d{2}/)?.[0] ||
        fixture.file.match(/20\d{2}/)?.[0] ||
        "2026";
      const currentSource: BookletDocumentExtraction = {
        fileId: `instructions-${fixture.file}`,
        fileName: `instructions-${fixture.file}.txt`,
        documentType: "email_export",
        employer: { name: evidence(employer), legalName: null, address: null, website: null },
        planYear: {
          start: evidence(`${year}-01-01`),
          end: evidence(`${year}-12-31`),
          label: evidence(year),
        },
        eligibility: {
          waitingPeriod: evidence("First of the month after 30 days"),
          description: evidence(
            "Full-time employees are eligible first of the month after 30 days.",
          ),
          employeeClasses: [evidence("Full-time employees")],
        },
        offeredBenefits: [
          {
            benefitType: "medical",
            offered: true,
            page: 1,
            quote: "Medical",
            confidence: 0.99,
          },
        ],
        selectedPlans: [
          {
            planName: attributes.identity.planName,
            benefitType: "medical",
            carrier: attributes.identity.carrier,
            page: 1,
            quote: attributes.identity.planName,
            confidence: 0.99,
          },
        ],
        contributions: [],
        contacts: [],
        accounts: [],
        sectionOrder: [],
        templateRole: "employer_factual",
        extractionMethod: "email_text",
        warnings: [],
      };
      const ratePlan = {
        id: `rate-${fixture.file}`,
        benefitType: "medical" as const,
        carrier: attributes.identity.carrier,
        effectiveDate: `${year}-01-01`,
        planName: attributes.identity.planName,
        tiers: [
          { tier: "employee", monthlyPremium: 750 },
          { tier: "employee_spouse", monthlyPremium: 1500 },
          { tier: "employee_children", monthlyPremium: 1275 },
          { tier: "family", monthlyPremium: 2150 },
        ],
        sourceFile: `rates-${fixture.file}.xlsx`,
        sourceFileId: `rates-${fixture.file}`,
        sourceSheet: "Rates",
        sourceRow: 2,
        confidence: 0.99,
        employerSpecific: true,
      };
      const rateContributions = ratePlan.tiers.map((tier) => ({
        benefitType: "medical" as const,
        planId: ratePlan.id,
        planName: ratePlan.planName,
        tier: tier.tier,
        employeeClass: null,
        mode: "percent" as const,
        value: 0.6,
        payPeriods: 26,
        sourceRefs: [],
        confidence: 0.99,
      }));
      const loadedFile = {
        id: fixture.file,
        companyId: `live-${fixture.file}`,
        fileName: fixture.file,
        storagePath: path.join("tests/fixtures/plans", fixture.file),
        mimeType: "application/pdf",
        uploadedAt: new Date().toISOString(),
        sha256: "live-fixture",
        processingStatus: "complete" as const,
        data: file,
      };
      const benefitsPackage = assembleBenefitsPackage({
        companyId: loadedFile.companyId,
        documentExtractions: [currentSource],
        rates: [ratePlan],
        rateContributions,
        medicalPlans: [
          {
            file: loadedFile,
            classification: {
              fileId: fixture.file,
              documentType: "sbc",
              confidence: 0.99,
              reasoningSummary: "Live SBC fixture",
            },
            attributes,
          },
        ],
      });
      const outline = generateBookletOutline(benefitsPackage);
      if (attributes.identity.hsaEligible)
        expect(outline.sections.some((section) => section.id === "hsa")).toBe(true);
      const pdf = await generateBenefitsPackagePdf(benefitsPackage, outline);
      const html = renderBenefitsPackageHtml(benefitsPackage, outline);
      const quality = await checkBookletQuality({ benefitsPackage, outline, html, pdf });
      expect(quality.passed).toBe(true);
      const pdfOutputDirectory = path.resolve("output/pdf/live");
      await fs.mkdir(pdfOutputDirectory, { recursive: true });
      await fs.writeFile(
        path.join(pdfOutputDirectory, fixture.file.replace(/\.pdf$/i, "-benefits-guide.pdf")),
        pdf,
      );
      if (process.env.LIVE_PLAN_OUTPUT_DIR) {
        const outputDirectory = path.resolve(process.env.LIVE_PLAN_OUTPUT_DIR);
        await fs.mkdir(outputDirectory, { recursive: true });
        await fs.writeFile(
          path.join(outputDirectory, fixture.file.replace(/\.pdf$/i, ".json")),
          `${JSON.stringify({ attributes, textPages: pages }, null, 2)}\n`,
        );
      }
    }, 300_000);
  }
});
