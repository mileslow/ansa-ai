import { createHash } from "node:crypto";
import {
  BENEFIT_REQUIREMENTS_REGISTRY,
  collectPredicateDependencies,
} from "./benefit-requirements";
import type {
  BenefitFieldRequirement,
  BenefitRequirementSubject,
  ExtractedRequirementCandidate,
  FieldResolution,
  RequirementEvidence,
  ResolutionMap,
  SourceAuthority,
} from "./benefit-requirements/types";
import type { BookletDocumentExtraction } from "./booklet-document-extractor";
import type {
  BenefitType,
  ClassifiedDocument,
  DocumentType,
} from "./booklet-types";

const PLAN_BENEFITS = new Set<BenefitType>([
  "medical", "dental", "vision", "std", "ltd",
]);

function stableId(...parts: string[]) {
  return createHash("sha256").update(parts.join("|")).digest("hex").slice(0, 20);
}

export function requirementEvidenceId(evidence: RequirementEvidence) {
  return (
    evidence.id ||
    `ev_${stableId(
      evidence.sourceFileId,
      evidence.authority,
      evidence.planOrProgramId || "",
      JSON.stringify(evidence.locator || null),
    )}`
  );
}

function authorityForLegacyType(documentType: DocumentType): SourceAuthority {
  if (documentType === "employer_application" || documentType === "email_export")
    return "employer_selection";
  if (documentType === "carrier_rate_sheet" || documentType === "renewal_spreadsheet")
    return "rate_or_contribution";
  if (documentType === "census") return "employer_eligibility";
  if (documentType === "prior_booklet") return "prior_year_context";
  if (documentType === "benefit_guide") return "unknown";
  if (["sbc", "spd", "plan_summary"].includes(documentType))
    return "current_plan_document";
  return "unknown";
}

function evidenceDomain(path: string): RequirementEvidence["authorityDomain"] {
  if (/offering|selectedByEmployer/i.test(path)) return "offering";
  if (/identity|administrator|custodian/i.test(path)) return "identity";
  if (/eligib|employeeClass|workStates/i.test(path)) return "eligibility";
  if (/rate|cost|funding|contribution|payroll/i.test(path)) return "rate";
  if (/contact|access|portal|website|phone/i.test(path)) return "contact";
  if (/formal|legal|notice|regulatory|governing/i.test(path))
    return "legal_or_regulatory";
  return "plan_design";
}

function candidate(
  extraction: BookletDocumentExtraction,
  classification: ClassifiedDocument | undefined,
  benefitType: BenefitType,
  path: string,
  value: unknown,
  input: {
    planOrProgramName?: string | null;
    planOrProgramId?: string | null;
    page?: number | null;
    quote?: string | null;
    confidence: number;
  },
): ExtractedRequirementCandidate {
  const evidence: RequirementEvidence = {
    id: `${extraction.fileId}:legacy:${stableId(path, String(input.page || ""), String(value))}`,
    sourceFileId: extraction.fileId,
    sourceFileName: extraction.fileName,
    authority:
      classification?.authority || authorityForLegacyType(extraction.documentType),
    authorityDomain: evidenceDomain(path),
    ...(classification?.effectiveStart
      ? { effectiveStart: classification.effectiveStart }
      : {}),
    ...(classification?.effectiveEnd
      ? { effectiveEnd: classification.effectiveEnd }
      : {}),
    ...(classification?.employerOrGroupId
      ? { employerOrGroupId: classification.employerOrGroupId }
      : {}),
    ...(input.planOrProgramId
      ? { planOrProgramId: input.planOrProgramId }
      : {}),
    ...(input.page
      ? {
          locator: {
            kind: "pdf" as const,
            page: input.page,
            ...(input.quote ? { quote: input.quote } : {}),
          },
        }
      : {}),
    extractionMethod:
      extraction.extractionMethod === "ocr" ? "ocr" : "text",
    extractorVersion: "legacy-summary-projection-v1",
    confidence: input.confidence,
  };
  return {
    subjectHint: {
      benefitType,
      ...(input.planOrProgramName
        ? { planOrProgramName: input.planOrProgramName }
        : {}),
      ...(input.planOrProgramId
        ? { planOrProgramId: input.planOrProgramId }
        : {}),
    },
    path,
    state: "known",
    value,
    rawValue: typeof value === "string" ? value : JSON.stringify(value),
    evidence,
    confidence: input.confidence,
  };
}

function offeringPath(benefitType: BenefitType) {
  if (["medical", "dental", "vision"].includes(benefitType))
    return `plans.${benefitType}.offering.selectedByEmployer`;
  if (["hsa", "hra", "fsa"].includes(benefitType))
    return `${benefitType}.offering.${benefitType === "hsa" || benefitType === "hra" ? "confirmed" : "confirmed"}`;
  return `${benefitType}.offeringStatus`;
}

/**
 * Migrates source-backed legacy summary fields into registry candidates. This
 * is not a package-value backfill: every candidate retains its original file,
 * authority, locator, and confidence.
 */
export function candidatesFromDocumentExtractions({
  extractions,
  classifications,
}: {
  extractions: BookletDocumentExtraction[];
  classifications: ClassifiedDocument[];
}) {
  const byFile = new Map(classifications.map((item) => [item.fileId, item]));
  const candidates: ExtractedRequirementCandidate[] = [];
  for (const extraction of extractions) {
    const classification = byFile.get(extraction.fileId);
    const registryCandidates = extraction.requirementCandidates || [];
    candidates.push(...registryCandidates);

    for (const offering of extraction.offeredBenefits) {
      if (!offering.offered) continue;
      candidates.push(
        candidate(
          extraction,
          classification,
          offering.benefitType,
          offeringPath(offering.benefitType),
          true,
          {
            page: offering.page,
            quote: offering.quote,
            confidence: offering.confidence,
          },
        ),
      );
    }

    for (const plan of extraction.selectedPlans) {
      const root = ["medical", "dental", "vision"].includes(plan.benefitType)
        ? `plans.${plan.benefitType}`
        : plan.benefitType;
      const planNamePath = ["medical", "dental", "vision"].includes(plan.benefitType)
        ? `${root}.identity.planName`
        : null;
      if (planNamePath)
        candidates.push(
          candidate(extraction, classification, plan.benefitType, planNamePath, plan.planName, {
            planOrProgramName: plan.planName,
            page: plan.page,
            quote: plan.quote,
            confidence: plan.confidence,
          }),
        );
      if (plan.carrier) {
        const path = ["medical", "dental", "vision"].includes(plan.benefitType)
          ? `${root}.identity.carrierOrAdministrator`
          : `${root}.administrator`;
        candidates.push(
          candidate(extraction, classification, plan.benefitType, path, plan.carrier, {
            planOrProgramName: plan.planName,
            page: plan.page,
            quote: plan.quote,
            confidence: plan.confidence,
          }),
        );
      }
      const period = {
        start: extraction.planYear.start?.value || classification?.effectiveStart,
        end: extraction.planYear.end?.value || classification?.effectiveEnd,
      };
      if (period.start || period.end) {
        const path = ["medical", "dental", "vision"].includes(plan.benefitType)
          ? `${root}.identity.coveragePeriod`
          : `${root}.effectivePeriod`;
        candidates.push(
          candidate(extraction, classification, plan.benefitType, path, period, {
            planOrProgramName: plan.planName,
            page: plan.page,
            quote: plan.quote,
            confidence: plan.confidence,
          }),
        );
      }
      if (classification?.authority === "current_plan_document") {
        const governingPath = ["medical", "dental", "vision"].includes(plan.benefitType)
          ? `${root}.documents.governingTerms`
          : `${root}.governingDocumentReference`;
        candidates.push(
          candidate(extraction, classification, plan.benefitType, governingPath, {
            fileId: extraction.fileId,
            fileName: extraction.fileName,
          }, {
            planOrProgramName: plan.planName,
            page: plan.page,
            quote: plan.quote,
            confidence: plan.confidence,
          }),
        );
      }
    }

    for (const account of extraction.accounts) {
      // The generic registry extraction owns subject identity. Reuse it when
      // projecting legacy account summaries so a custodian name (for example,
      // Optum) cannot become a second HSA/HRA/FSA program subject.
      const registryHint = registryCandidates.find(
        (item) =>
          item.subjectHint.benefitType === account.type &&
          (item.subjectHint.planOrProgramId ||
            item.subjectHint.planOrProgramName),
      )?.subjectHint;
      const accountSubjectName =
        registryHint?.planOrProgramName || account.type.toUpperCase();
      const accountSubjectId = registryHint?.planOrProgramId || null;
      const namePath = `${account.type}.identity.displayName`;
      candidates.push(
        candidate(
          extraction,
          classification,
          account.type,
          namePath,
          account.administrator ? `${account.administrator} ${account.type.toUpperCase()}` : account.type.toUpperCase(),
          {
            planOrProgramName: accountSubjectName,
            planOrProgramId: accountSubjectId,
            page: account.page,
            confidence: account.confidence,
          },
        ),
      );
      if (account.administrator) {
        const administratorPath =
          account.type === "hsa"
            ? "hsa.administration.custodian.name"
            : `${account.type}.administration.administrator.name`;
        candidates.push(
          candidate(
            extraction,
            classification,
            account.type,
            administratorPath,
            account.administrator,
            {
              planOrProgramName: accountSubjectName,
              planOrProgramId: accountSubjectId,
              page: account.page,
              confidence: account.confidence,
            },
          ),
        );
      }
    }
  }
  return candidates;
}

function normalizedName(value: string | undefined) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function stableValue(value: unknown): string {
  if (typeof value === "string") return `s:${normalizedName(value)}`;
  if (Array.isArray(value)) return `[${value.map(stableValue).join(",")}]`;
  if (value && typeof value === "object")
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => `${key}:${stableValue(item)}`)
      .join(",")}}`;
  return `${typeof value}:${String(value)}`;
}

function manualResolution(
  answer: unknown,
  companyId: string,
  subject: BenefitRequirementSubject,
  requirement: BenefitFieldRequirement,
): FieldResolution {
  const evidence: RequirementEvidence = {
    id: `manual:${stableId(companyId, subject.id, requirement.id)}`,
    sourceFileId: `manual:${subject.id}:${requirement.id}`,
    sourceFileName: "User answer",
    authority: "manual_answer",
    authorityDomain: evidenceDomain(requirement.path),
    employerOrGroupId: companyId,
    planOrProgramId: subject.planOrProgramId,
    extractionMethod: "manual",
    confidence: 1,
  };
  if (typeof answer === "string" && answer.startsWith("explicit_none:"))
    return {
      status: "explicit_none",
      reasonCode: answer.slice("explicit_none:".length),
      evidence: [evidence],
    };
  if (typeof answer === "string" && answer.startsWith("not_applicable:"))
    return {
      status: "not_applicable",
      reasonCode: answer.slice("not_applicable:".length),
      evidence: [evidence],
    };
  if (answer && typeof answer === "object" && !Array.isArray(answer)) {
    const value = answer as Record<string, unknown>;
    if (value.state === "explicit_none")
      return {
        status: "explicit_none",
        reasonCode: String(value.reasonCode || ""),
        evidence: [evidence],
      };
    if (value.state === "not_applicable")
      return {
        status: "not_applicable",
        reasonCode: String(value.reasonCode || ""),
        evidence: [evidence],
      };
    if (value.state === "requires_legal_determination")
      return {
        status: "requires_legal_determination",
        issueCode: String(value.issueCode || "MANUAL_LEGAL_REVIEW"),
        evidence: [evidence],
      };
    if (Object.prototype.hasOwnProperty.call(value, "value"))
      return { status: "known", value: value.value, evidence: [evidence] };
  }
  return { status: "known", value: answer, evidence: [evidence] };
}

function resolveCandidates(
  requirement: BenefitFieldRequirement | undefined,
  candidates: ExtractedRequirementCandidate[],
  searchedSourceFileIds: string[],
): FieldResolution {
  const authorityAccepted = candidates.filter(
    (item) =>
      !requirement ||
      requirement.acceptedAuthorities.includes(item.evidence.authority),
  );
  if (!authorityAccepted.length) {
    if (candidates.length)
      return {
        status: "unknown",
        reasonCode: "AUTHORITY_NOT_ACCEPTED",
        expectedSourceKinds: requirement?.acceptedAuthorities,
      };
    return { status: "not_found", searchedSourceFileIds };
  }
  const positive = authorityAccepted.filter((item) => item.state !== "not_found");
  if (!positive.length)
    return {
      status: "not_found",
      searchedSourceFileIds: [
        ...new Set([
          ...searchedSourceFileIds,
          ...authorityAccepted.map((item) => item.evidence.sourceFileId),
        ]),
      ],
    };

  // A current amendment deterministically supersedes an otherwise matching
  // plan-document candidate. Confidence never supersedes authority.
  const amendments = positive.filter(
    (item) => item.evidence.authority === "current_amendment_or_rider",
  );
  let authoritySelected = amendments.length ? amendments : positive;
  if (
    !amendments.length &&
    requirement &&
    (/\.identity\./.test(requirement.path) ||
      /\.coverage\.coverageFor$/.test(requirement.path))
  ) {
    const identityAuthorityOrder: SourceAuthority[] = [
      "current_plan_document",
      "administrator_material",
      "employer_selection",
      "employer_eligibility",
      "rate_or_contribution",
      "approved_boilerplate",
      "regulatory_source",
      "prior_year_context",
      "generic_marketing",
      "unknown",
    ];
    const bestAuthorityRank = Math.min(
      ...authoritySelected.map((item) => {
        const rank = identityAuthorityOrder.indexOf(item.evidence.authority);
        return rank === -1 ? identityAuthorityOrder.length : rank;
      }),
    );
    authoritySelected = authoritySelected.filter((item) => {
      const rank = identityAuthorityOrder.indexOf(item.evidence.authority);
      return (rank === -1 ? identityAuthorityOrder.length : rank) === bestAuthorityRank;
    });
  }
  const extractorRank = (item: ExtractedRequirementCandidate) => {
    if (item.evidence.extractorVersion === "medical-plan-schema-v1") return 30;
    if (item.evidence.extractorVersion === "rate-sheet-v1") return 30;
    if (item.evidence.extractorVersion === "benefit-requirements-v1") return 20;
    if (item.evidence.extractorVersion === "legacy-summary-projection-v1") return 10;
    return 20;
  };
  const bestRankBySource = new Map<string, number>();
  for (const item of authoritySelected) {
    const key = `${item.evidence.sourceFileId}:${item.evidence.authority}`;
    bestRankBySource.set(
      key,
      Math.max(bestRankBySource.get(key) || 0, extractorRank(item)),
    );
  }
  // Multiple parsers can project the same source. The path-specific parser is
  // authoritative over the generic/legacy projection for that same file, but
  // never suppresses a disagreement from a different source.
  const selected = authoritySelected.filter((item) => {
    const key = `${item.evidence.sourceFileId}:${item.evidence.authority}`;
    return extractorRank(item) === bestRankBySource.get(key);
  });
  const groups = new Map<string, ExtractedRequirementCandidate[]>();
  for (const item of selected) {
    const key =
      item.state === "known"
        ? `known:${stableValue(item.value)}`
        : `${item.state}:${item.reasonCode || ""}`;
    groups.set(key, [...(groups.get(key) || []), item]);
  }
  if (groups.size > 1)
    return {
      status: "conflicting",
      candidates: [...groups.entries()].map(([key, items]) => ({
        value: items[0].state === "known" ? items[0].value : key,
        evidence: items.map((item) => item.evidence),
      })),
    };
  const item = selected[0];
  const evidence = selected.map((entry) => entry.evidence);
  if (item.state === "explicit_none")
    return {
      status: "explicit_none",
      reasonCode: item.reasonCode || "",
      evidence,
    };
  if (item.state === "not_applicable")
    return {
      status: "not_applicable",
      reasonCode: item.reasonCode || "",
      evidence,
    };
  return { status: "known", value: item.value, evidence };
}

function subjectIdentity(candidate: ExtractedRequirementCandidate) {
  return (
    candidate.subjectHint.planOrProgramId ||
    normalizedName(candidate.subjectHint.planOrProgramName) ||
    "default"
  );
}

export function buildBenefitRequirementSubjects({
  companyId,
  classifications,
  candidates,
  manualAnswers,
}: {
  companyId: string;
  classifications: ClassifiedDocument[];
  candidates: ExtractedRequirementCandidate[];
  manualAnswers: Record<string, unknown>;
}): BenefitRequirementSubject[] {
  const dependencies = collectPredicateDependencies();
  const subjects: BenefitRequirementSubject[] = [];

  for (const benefitType of Object.keys(BENEFIT_REQUIREMENTS_REGISTRY) as BenefitType[]) {
    const definition = BENEFIT_REQUIREMENTS_REGISTRY[benefitType];
    const benefitCandidates = candidates.filter(
      (item) => item.subjectHint.benefitType === benefitType,
    );
    if (!benefitCandidates.length) continue;
    const selectedEmployerGroups = [
      ...new Set(
        benefitCandidates
          .filter((item) => item.evidence.authority === "employer_selection")
          .map((item) => item.evidence.employerOrGroupId)
          .filter((value): value is string => Boolean(value)),
      ),
    ];
    const expectedEmployerGroup =
      selectedEmployerGroups.length === 1 ? selectedEmployerGroups[0] : undefined;
    const currentEmployerAliases = new Set(
      [
        companyId,
        ...classifications
          .filter((item) => item.scope === "current_employer")
          .map((item) => item.employerOrGroupId)
          .filter((value): value is string => Boolean(value)),
      ].map(normalizedName),
    );
    const employerSelectedIdentities = [
      ...new Set(
        benefitCandidates
          .filter(
            (item) =>
              item.evidence.authority === "employer_selection" &&
              (item.subjectHint.planOrProgramId ||
                item.subjectHint.planOrProgramName),
          )
          .map(subjectIdentity),
      ),
    ];
    const canonicalIdentity = (item: ExtractedRequirementCandidate) => {
      const own = subjectIdentity(item);
      const hintedName = normalizedName(item.subjectHint.planOrProgramName);
      const exactEmployerIdentity = employerSelectedIdentities.find(
        (selected) => selected === hintedName,
      );
      if (exactEmployerIdentity) return exactEmployerIdentity;
      if (
        employerSelectedIdentities.length === 1 &&
        item.evidence.authority === "current_plan_document"
      )
        return employerSelectedIdentities[0];
      return own;
    };
    const explicitIdentities = new Map<string, ExtractedRequirementCandidate>();
    for (const item of benefitCandidates) {
      if (
        item.subjectHint.planOrProgramId ||
        item.subjectHint.planOrProgramName
      )
        explicitIdentities.set(canonicalIdentity(item), item);
    }
    if (!explicitIdentities.size)
      explicitIdentities.set("default", benefitCandidates[0]);

    for (const [identity, seed] of explicitIdentities) {
      const id = `benefit_${stableId(companyId, benefitType, identity)}`;
      const displayName =
        seed.subjectHint.planOrProgramName || definition.title;
      const candidateSourceIds = new Set(
        benefitCandidates.map((item) => item.evidence.sourceFileId),
      );
      const enforcementStatus = classifications.some(
        (item) =>
          candidateSourceIds.has(item.fileId) &&
          item.scope !== undefined &&
          item.authority !== undefined,
      )
        ? "registry_enforced"
        : "legacy_unenforced";
      const subject: BenefitRequirementSubject = {
        id,
        benefitType,
        entityKind: definition.entityKind,
        displayName,
        employerOrGroupId: companyId,
        ...(seed.subjectHint.planOrProgramId
          ? { planOrProgramId: seed.subjectHint.planOrProgramId }
          : {}),
        ...(seed.evidence.effectiveStart
          ? { effectiveStart: seed.evidence.effectiveStart }
          : {}),
        ...(seed.evidence.effectiveEnd
          ? { effectiveEnd: seed.evidence.effectiveEnd }
          : {}),
        resolutions: {},
        enforcementStatus,
      };
      const paths = [
        ...new Set([
          ...definition.fields.map((field) => field.path),
          ...dependencies[benefitType],
        ]),
      ];
      const searchedSourceFileIds = [
        ...new Set(benefitCandidates.map((item) => item.evidence.sourceFileId)),
      ];
      const resolutions: ResolutionMap = {};
      for (const path of paths) {
        const requirement = definition.fields.find((field) => field.path === path);
        const scoped = benefitCandidates.filter((item) => {
          if (item.path !== path) return false;
          if (
            expectedEmployerGroup &&
            item.evidence.employerOrGroupId &&
            item.evidence.employerOrGroupId !== expectedEmployerGroup &&
            !currentEmployerAliases.has(
              normalizedName(item.evidence.employerOrGroupId),
            )
          )
            return false;
          if (
            subject.effectiveStart &&
            item.evidence.effectiveEnd &&
            item.evidence.effectiveEnd < subject.effectiveStart
          )
            return false;
          if (
            subject.effectiveEnd &&
            item.evidence.effectiveStart &&
            item.evidence.effectiveStart > subject.effectiveEnd
          )
            return false;
          const candidateIdentity = canonicalIdentity(item);
          if (candidateIdentity === identity) return true;
          const hasHint = Boolean(
            item.subjectHint.planOrProgramId ||
              item.subjectHint.planOrProgramName,
          );
          // Offering evidence and routing context may apply to every explicitly
          // named option. Unhinted design facts never leak across multiple plans.
          return (
            !hasHint &&
            (explicitIdentities.size === 1 ||
              /offering|selectedByEmployer/.test(path) ||
              dependencies[benefitType].includes(path))
          );
        });
        resolutions[path] = resolveCandidates(
          requirement,
          scoped,
          searchedSourceFileIds,
        );
      }
      // Artifact mode is pipeline context, not a model guess.
      if (paths.includes("booklet.mode"))
        resolutions["booklet.mode"] = {
          status: "known",
          value: "enrollment",
          evidence: [],
        };
      const disambiguationPath = `plans.${benefitType}.identity.requiresOptionDisambiguation`;
      if (paths.includes(disambiguationPath))
        resolutions[disambiguationPath] = {
          status: "known",
          value: explicitIdentities.size > 1,
          evidence: [],
        };
      const regionalPath = `plans.${benefitType}.identity.isRegional`;
      const serviceAreaPath = `plans.${benefitType}.identity.serviceArea`;
      if (
        paths.includes(regionalPath) &&
        resolutions[regionalPath]?.status !== "known" &&
        resolutions[serviceAreaPath]?.status === "known"
      )
        resolutions[regionalPath] = {
          status: "known",
          value: true,
          evidence:
            resolutions[serviceAreaPath].status === "known"
              ? resolutions[serviceAreaPath].evidence
              : [],
        };
      subject.resolutions = resolutions;

      for (const requirement of definition.fields) {
        const answerKey = `requirements.${subject.id}.${requirement.id}`;
        if (Object.prototype.hasOwnProperty.call(manualAnswers, answerKey))
          subject.resolutions[requirement.path] = manualResolution(
            manualAnswers[answerKey],
            companyId,
            subject,
            requirement,
          );
      }
      for (const dependencyPath of dependencies[benefitType]) {
        const answerKey = `requirements.${subject.id}.dependencies.${dependencyPath}`;
        if (!Object.prototype.hasOwnProperty.call(manualAnswers, answerKey))
          continue;
        const evidence: RequirementEvidence = {
          id: `manual:${stableId(companyId, subject.id, dependencyPath)}`,
          sourceFileId: `manual:${subject.id}:${dependencyPath}`,
          sourceFileName: "User answer",
          authority: "manual_answer",
          authorityDomain: evidenceDomain(dependencyPath),
          employerOrGroupId: companyId,
          planOrProgramId: subject.planOrProgramId,
          extractionMethod: "manual",
          confidence: 1,
        };
        subject.resolutions[dependencyPath] = {
          status: "known",
          value: manualAnswers[answerKey],
          evidence: [evidence],
        };
      }
      subjects.push(subject);
    }
  }
  return subjects.sort((left, right) => left.id.localeCompare(right.id));
}
