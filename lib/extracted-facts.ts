import { createHash } from "node:crypto";
import type { ExtractedMedicalPlan } from "./benefits-package-assembler";
import type { BookletDocumentExtraction } from "./booklet-document-extractor";
import { extractionSource } from "./booklet-document-extractor";
import type { ExtractedFact, LoadedUploadedFile } from "./booklet-types";

const id = (...parts: string[]) =>
  createHash("sha1").update(parts.join("|")).digest("hex").slice(0, 24);

function fact(
  companyId: string,
  extraction: BookletDocumentExtraction,
  path: string,
  value: unknown,
  confidence: number,
  page?: number | null,
  quote?: string | null,
): ExtractedFact {
  const source = extractionSource(extraction, page || null, quote);
  return {
    id: id(extraction.fileId, path, JSON.stringify(value)),
    companyId,
    fileId: extraction.fileId,
    documentType: extraction.documentType,
    path,
    value,
    normalizedValue:
      typeof value === "string" ? value.toLowerCase().replace(/\s+/g, " ").trim() : value,
    confidence,
    source,
    extractionMethod: source.extractionMethod,
    createdAt: new Date().toISOString(),
  };
}

export function factsFromDocumentExtraction(
  companyId: string,
  extraction: BookletDocumentExtraction,
) {
  const facts: ExtractedFact[] = [];
  const pushEvidence = (
    path: string,
    evidence:
      | {
          value: string;
          confidence: number;
          page?: number | null;
          quote?: string | null;
        }
      | null,
  ) => {
    if (evidence?.value)
      facts.push(
        fact(
          companyId,
          extraction,
          path,
          evidence.value,
          evidence.confidence,
          evidence.page,
          evidence.quote,
        ),
      );
  };
  pushEvidence("employer.name", extraction.employer.name);
  pushEvidence("employer.legalName", extraction.employer.legalName);
  pushEvidence("employer.address", extraction.employer.address);
  pushEvidence("employer.website", extraction.employer.website);
  for (const [key, value] of Object.entries(extraction.companyProfile || {})) {
    if (value)
      facts.push(
        fact(
          companyId,
          extraction,
          `employer.publicProfile.${key}`,
          value,
          0.85,
          null,
          `${key}: ${value}`,
        ),
      );
  }
  pushEvidence("planYear.start", extraction.planYear.start);
  pushEvidence("planYear.end", extraction.planYear.end);
  pushEvidence("planYear.label", extraction.planYear.label);
  pushEvidence("eligibility.waitingPeriod", extraction.eligibility.waitingPeriod);
  pushEvidence("eligibility.description", extraction.eligibility.description);
  extraction.eligibility.employeeClasses.forEach((entry, index) =>
    pushEvidence(`eligibility.employeeClasses[${index}]`, entry),
  );
  extraction.offeredBenefits.forEach((entry, index) =>
    facts.push(
      fact(
        companyId,
        extraction,
        `offeredBenefits[${index}].${entry.benefitType}`,
        entry.offered,
        entry.confidence,
        entry.page,
        entry.quote,
      ),
    ),
  );
  extraction.selectedPlans.forEach((entry, index) =>
    facts.push(
      fact(
        companyId,
        extraction,
        `selectedPlans[${index}].planName`,
        entry.planName,
        entry.confidence,
        entry.page,
        entry.quote,
      ),
    ),
  );
  extraction.contributions.forEach((entry, index) =>
    facts.push(
      fact(
        companyId,
        extraction,
        `contributions[${index}]`,
        entry,
        entry.confidence,
        entry.page,
        entry.quote,
      ),
    ),
  );
  extraction.contacts.forEach((entry, index) =>
    facts.push(
      fact(
        companyId,
        extraction,
        `contacts[${index}]`,
        entry,
        entry.confidence,
        entry.page,
      ),
    ),
  );
  return facts;
}

export function factsFromMedicalPlan(plan: ExtractedMedicalPlan): ExtractedFact[] {
  const source = (page?: number) => ({
    fileId: plan.file.id,
    fileName: plan.file.fileName,
    documentType: plan.classification.documentType,
    page,
    extractionMethod: "model" as const,
  });
  const values: Array<[string, unknown, number | undefined]> = [
    ["plan.identity", plan.attributes.identity, plan.attributes.identity.sourcePages[0]],
    ["plan.financial", plan.attributes.financial, plan.attributes.financial.sourcePages[0]],
    ["plan.network", plan.attributes.network, plan.attributes.network.sourcePages[0]],
    ["plan.services", plan.attributes.services, plan.attributes.services[0]?.sourcePage],
    [
      "plan.prescriptions",
      plan.attributes.prescriptions,
      plan.attributes.prescriptions.sourcePages[0],
    ],
  ];
  return values.map(([path, value, page]) => ({
    id: id(plan.file.id, path),
    companyId: plan.file.companyId,
    fileId: plan.file.id,
    documentType: plan.classification.documentType,
    path,
    value,
    normalizedValue: value,
    confidence: 0.95,
    source: source(page),
    extractionMethod: "model",
    createdAt: new Date().toISOString(),
  }));
}

export function factsFromManualAnswers(
  companyId: string,
  answers: Record<string, unknown>,
): ExtractedFact[] {
  return Object.entries(answers).map(([path, value]) => ({
    id: id("manual", companyId, path, JSON.stringify(value)),
    companyId,
    fileId: `manual:${id(companyId, path)}`,
    documentType: "manual_answer",
    path,
    value,
    normalizedValue: value,
    confidence: 1,
    source: {
      fileId: `manual:${id(companyId, path)}`,
      fileName: "User answer",
      documentType: "manual_answer",
      extractionMethod: "manual",
    },
    extractionMethod: "manual",
    createdAt: new Date().toISOString(),
  }));
}
