import { createHash } from "node:crypto";
import type { ExtractedMedicalPlan } from "./benefits-package-assembler";
import type { BookletDocumentExtraction } from "./booklet-document-extractor";
import { extractionSource } from "./booklet-document-extractor";
import type {
  CarrierRatePlan,
  ContributionRule,
  ExtractedFact,
  LoadedUploadedFile,
} from "./booklet-types";
import type {
  ExtractedRequirementCandidate,
  RequirementEvidence,
} from "./benefit-requirements/types";
import {
  calculateContribution,
  findContributionRule,
} from "./contribution-engine";

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

function present(value: unknown) {
  if (value === null || value === undefined || value === "") return false;
  if (Array.isArray(value)) return value.length > 0;
  return true;
}

/** Projects the detailed medical parser into canonical registry paths. */
export function requirementCandidatesFromMedicalPlan(
  plan: ExtractedMedicalPlan,
): ExtractedRequirementCandidate[] {
  const attributes = plan.attributes;
  const hint = {
    benefitType: "medical" as const,
    planOrProgramName: attributes.identity.planName,
    ...(attributes.identity.planId
      ? { planOrProgramId: attributes.identity.planId }
      : {}),
  };
  const authority = plan.classification.authority || "current_plan_document";
  const result: ExtractedRequirementCandidate[] = [];
  const evidenceFor = (path: string, pages: number[]) => {
    const page = pages[0];
    return {
      id: `${plan.file.id}:medical:${id(path)}`,
      sourceFileId: plan.file.id,
      sourceFileName: plan.file.fileName,
      authority,
      authorityDomain: /identity/.test(path)
        ? "identity"
        : /contact|directory/.test(path)
          ? "contact"
          : "plan_design",
      ...(plan.classification.effectiveStart
        ? { effectiveStart: plan.classification.effectiveStart }
        : {}),
      ...(plan.classification.effectiveEnd
        ? { effectiveEnd: plan.classification.effectiveEnd }
        : {}),
      ...(plan.classification.employerOrGroupId
        ? { employerOrGroupId: plan.classification.employerOrGroupId }
        : {}),
      ...(attributes.identity.planId
        ? { planOrProgramId: attributes.identity.planId }
        : {}),
      ...(page
        ? { locator: { kind: "pdf" as const, page } }
        : {}),
      extractionMethod: "text",
      extractorVersion: "medical-plan-schema-v1",
      confidence: 0.95,
    } satisfies RequirementEvidence;
  };
  const add = (path: string, value: unknown, pages: number[]) => {
    if (!present(value)) return;
    result.push({
      subjectHint: hint,
      path,
      state: "known",
      value,
      rawValue: typeof value === "string" ? value : JSON.stringify(value),
      evidence: evidenceFor(path, pages),
      confidence: 0.95,
    });
  };
  const addExplicitNone = (path: string, reasonCode: string, pages: number[]) =>
    result.push({
      subjectHint: hint,
      path,
      state: "explicit_none",
      reasonCode,
      evidence: evidenceFor(path, pages),
      confidence: 0.95,
    });

  const identityPages = attributes.identity.sourcePages;
  const financialPages = attributes.financial.sourcePages;
  const networkPages = attributes.network.sourcePages;
  const servicePages = [...new Set(attributes.services.map((item) => item.sourcePage))];
  const prescriptionPages = attributes.prescriptions.sourcePages;
  const memberContact = attributes.contacts.find((contact) =>
    [contact.phone, contact.email, contact.url].some(present),
  );
  const networkTiers = [
    ...new Set(
      attributes.services.flatMap((service) =>
        [...service.inNetwork, ...service.outOfNetwork].map(
          (cost) => cost.networkTier,
        ),
      ),
    ),
  ].filter(Boolean);

  add("plans.medical.identity.planName", attributes.identity.planName, identityPages);
  add("plans.medical.identity.carrierOrAdministrator", attributes.identity.carrier, identityPages);
  add("plans.medical.identity.planOrOptionId", attributes.identity.planId, identityPages);
  add(
    "plans.medical.identity.coveragePeriod",
    {
      start: attributes.identity.coverageStart,
      end: attributes.identity.coverageEnd,
    },
    identityPages,
  );
  add("plans.medical.identity.planDesign", attributes.identity.planType, identityPages);
  add("plans.medical.identity.serviceArea", attributes.identity.state, identityPages);
  add("plans.medical.coverage.coverageFor", attributes.identity.coverageFor, identityPages);
  add("plans.medical.compatibility.hsaEligible", attributes.identity.hsaEligible, identityPages);
  add(
    "plans.medical.compatibility.marketedAsHsaCompatible",
    attributes.identity.hsaEligible,
    identityPages,
  );
  add("plans.medical.network.usesNetwork", attributes.network.usesProviderNetwork, networkPages);
  add("plans.medical.network.tiers", networkTiers, networkPages.length ? networkPages : servicePages);
  add("plans.medical.network.outOfNetworkStatus", attributes.network.outOfNetworkCoverage, networkPages);
  add("plans.medical.network.providerDirectory", attributes.network.providerDirectoryUrl, networkPages);
  add(
    "plans.medical.network.referralRule",
    {
      required: attributes.network.referralRequired,
      notes: attributes.network.referralNotes,
    },
    networkPages,
  );
  add("plans.medical.financial.deductible", attributes.financial.deductible, financialPages);
  add(
    "plans.medical.financial.outOfPocketLimit",
    attributes.financial.outOfPocketLimit,
    financialPages,
  );
  add(
    "plans.medical.financial.servicesBeforeDeductible",
    attributes.financial.servicesBeforeDeductible,
    financialPages,
  );
  add(
    "plans.medical.financial.specificDeductibles",
    attributes.financial.specificDeductibles,
    financialPages,
  );
  if (
    !attributes.financial.specificDeductibles.length &&
    attributes.financial.specificDeductiblesStatus === "explicit_none"
  )
    addExplicitNone(
      "plans.medical.financial.specificDeductibles",
      "NO_SERVICE_SPECIFIC_DEDUCTIBLES",
      financialPages,
    );
  add(
    "plans.medical.financial.excludedFromOutOfPocket",
    attributes.financial.excludedFromOutOfPocket,
    financialPages,
  );
  add("plans.medical.services.commonEventSchedule", attributes.services, servicePages);
  add("plans.medical.services.coreBookletSchedule", attributes.services, servicePages);
  add("plans.medical.services.costSharingCells", attributes.services, servicePages);
  add(
    "plans.medical.services.qualifiers",
    attributes.services.map((service) => ({
      service: service.service,
      limitations: service.limitations,
      preauthorization: service.preauthorization,
      visitOrUnitLimit: service.visitOrUnitLimit,
      ageLimit: service.ageLimit,
    })),
    servicePages,
  );
  add(
    "plans.medical.prescriptions.tierSchedule",
    attributes.prescriptions.tiers,
    prescriptionPages,
  );
  if (attributes.prescriptions.tiers.length)
    add(
      "plans.medical.prescriptions.covered",
      true,
      prescriptionPages,
    );
  add(
    "plans.medical.prescriptions.formularyContact",
    {
      url: attributes.prescriptions.drugListUrl,
      pharmacyNetworkNotes: attributes.prescriptions.pharmacyNetworkNotes,
    },
    prescriptionPages,
  );
  add(
    "plans.medical.coverage.exclusionsAndOtherServices",
    { exclusions: attributes.exclusions, otherCoveredServices: attributes.otherCoveredServices },
    [...new Set([
      ...attributes.exclusions.flatMap((item) => item.sourcePages),
      ...attributes.otherCoveredServices.flatMap((item) => item.sourcePages),
    ])],
  );
  add("plans.medical.formal.coverageExamples", attributes.coverageExamples, attributes.coverageExamples.map((item) => item.sourcePage));
  add(
    "plans.medical.contacts.memberServices",
    memberContact,
    identityPages,
  );
  add(
    "plans.medical.documents.governingTerms",
    { fileId: plan.file.id, fileName: plan.file.fileName },
    identityPages,
  );
  return result;
}

export function requirementCandidatesFromRates({
  companyId,
  rates,
  contributions,
  selectedRatePlanIds,
}: {
  companyId: string;
  rates: CarrierRatePlan[];
  contributions: ContributionRule[];
  selectedRatePlanIds?: string[];
}): ExtractedRequirementCandidate[] {
  const result: ExtractedRequirementCandidate[] = [];
  const selected = new Set((selectedRatePlanIds || []).filter(Boolean));
  const restrictToSelected = selectedRatePlanIds !== undefined;
  for (const rate of rates) {
    if (!["medical", "dental", "vision"].includes(rate.benefitType)) continue;
    if (
      !rate.employerSpecific ||
      (restrictToSelected && !selected.has(rate.id))
    )
      continue;
    const root = `plans.${rate.benefitType}`;
    const evidence = (path: string): RequirementEvidence => ({
      id: `${rate.sourceFileId}:rate:${id(rate.id, path)}`,
      sourceFileId: rate.sourceFileId,
      sourceFileName: rate.sourceFile,
      authority: "rate_or_contribution",
      authorityDomain: /offering/.test(path) ? "offering" : "rate",
      employerOrGroupId: companyId,
      planOrProgramId: rate.id,
      ...(rate.effectiveDate ? { effectiveStart: rate.effectiveDate } : {}),
      locator: {
        kind: "sheet",
        sheet: rate.sourceSheet,
        row: rate.sourceRow,
      },
      extractionMethod: "spreadsheet",
      extractorVersion: "rate-sheet-v1",
      confidence: rate.confidence,
    });
    const add = (path: string, value: unknown) =>
      result.push({
        subjectHint: {
          benefitType: rate.benefitType,
          planOrProgramName: rate.planName,
          planOrProgramId: rate.id,
        },
        path,
        state: "known",
        value,
        rawValue: JSON.stringify(value),
        evidence: evidence(path),
        confidence: rate.confidence,
      });
    add(`${root}.offering.selectedByEmployer`, true);
    const costs = rate.tiers.map((tier) => {
      const rule = findContributionRule(
        contributions,
        rate.benefitType,
        rate.id,
        rate.planName,
        tier.tier,
      );
      return {
        tier: tier.tier,
        monthlyPremium: tier.monthlyPremium,
        ...(rule
          ? calculateContribution(tier.monthlyPremium, rule)
          : {
              employerMonthly: tier.employerMonthly,
              employeeMonthly: tier.employeeMonthly,
            }),
      };
    });
    if (costs.some((item) => present(item.employeeMonthly)))
      add(`${root}.rates.employeeCost`, costs);
    const payPeriods = [
      ...new Set(
        contributions
          .filter(
            (rule) =>
              rule.planId === rate.id ||
              rule.planName?.toLowerCase() === rate.planName.toLowerCase(),
          )
          .map((rule) => rule.payPeriods),
      ),
    ];
    add(`${root}.rates.includesPerPayAmounts`, payPeriods.length > 0);
    if (payPeriods.length)
      add(`${root}.rates.payFrequency`, {
        payPeriodsPerYear: payPeriods,
      });
    add(`${root}.rates.requiresPlanJoin`, true);
    add(`${root}.rates.providedSeparately`, false);
  }
  return result;
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
