import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { assembleBenefitsPackage } from "../lib/benefits-package-assembler";
import { generateBenefitsPackagePdf } from "../lib/benefits-booklet-generator";
import { checkBookletQuality } from "../lib/booklet-quality-checker";
import { generateBookletOutline } from "../lib/booklet-outline";
import type { LoadedUploadedFile } from "../lib/booklet-types";
import { extractRateSheet } from "../lib/rate-sheet-extractor";

async function main() {
const workbookPath = path.join(
  process.cwd(),
  "notion-call-transcripts",
  "ER and EE cost per month spreadsheet.xlsx",
);
const data = await fs.readFile(workbookPath);
const rateFile: LoadedUploadedFile = {
  id: "fixture-rates",
  companyId: "fixture-company",
  fileName: path.basename(workbookPath),
  storagePath: workbookPath,
  mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  uploadedAt: new Date().toISOString(),
  sha256: createHash("sha256").update(data).digest("hex"),
  processingStatus: "uploaded",
  data,
};
const rates = extractRateSheet(rateFile);
const evidence = (value: string, page = 1) => ({
  value,
  page,
  quote: value,
  confidence: 0.99,
});
const extraction = {
  fileId: "fixture-instructions",
  fileName: "fixture-employer-instructions.txt",
  documentType: "email_export" as const,
  employer: {
    name: evidence("Northstar Fabrication LLC"),
    legalName: evidence("Northstar Fabrication LLC"),
    address: evidence("Rochester, New York"),
    website: null,
  },
  planYear: {
    start: evidence("2026-01-01"),
    end: evidence("2026-12-31"),
    label: evidence("2026 Plan Year"),
  },
  eligibility: {
    waitingPeriod: evidence("First of the month after 30 days of employment"),
    description: evidence(
      "Full-time employees are eligible on the first of the month after 30 days of employment.",
    ),
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
  contacts: [
    {
      role: "Human Resources",
      name: "Benefits Team",
      organization: "Northstar Fabrication LLC",
      phone: "585-555-0188",
      email: "benefits@northstar.test",
      website: null,
      page: 1,
      confidence: 0.99,
    },
  ],
  accounts: [],
  sectionOrder: [],
  templateRole: "employer_factual" as const,
  extractionMethod: "model" as const,
  warnings: [],
};
const benefitsPackage = assembleBenefitsPackage({
  companyId: "fixture-company",
  documentExtractions: [extraction],
  rates: rates.plans,
  rateContributions: rates.contributions,
  medicalPlans: [],
});
const outline = generateBookletOutline(benefitsPackage);
const pdf = await generateBenefitsPackagePdf(benefitsPackage, outline);
const quality = await checkBookletQuality({ benefitsPackage, outline, pdf });
if (!quality.passed)
  throw new Error(
    `Generated fixture failed quality checks: ${quality.issues.map((issue) => issue.message).join(" ")}`,
  );
const outputDirectory = path.join(process.cwd(), "output", "pdf");
await fs.mkdir(outputDirectory, { recursive: true });
const outputPath = path.join(
  outputDirectory,
  "northstar-fabrication-2026-benefits-guide.pdf",
);
await fs.writeFile(outputPath, pdf);
console.log(JSON.stringify({ outputPath, bytes: pdf.length, pageCount: quality.pageCount }));
}

void main();
