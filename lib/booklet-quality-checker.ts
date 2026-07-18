import { PDFDocument } from "pdf-lib";
import type {
  BenefitsPackage,
  BenefitsPackageRequirements,
  BlockerQuestion,
  BookletOutline,
} from "./booklet-types";

export type QualityIssue = {
  code: string;
  message: string;
  blocking: boolean;
};

export type QualityReport = {
  passed: boolean;
  issues: QualityIssue[];
  pageCount?: number;
};

const requiredSections = [
  "cover",
  "toc",
  "welcome",
  "eligibility",
  "enrollment",
  "contacts",
  "legal",
];

export async function checkBookletQuality({
  benefitsPackage,
  outline,
  questions = [],
  html,
  pdf,
  requirements = benefitsPackage.requirements,
  requireRegistryEnforcement = false,
}: {
  benefitsPackage: BenefitsPackage;
  outline: BookletOutline;
  questions?: BlockerQuestion[];
  html?: string;
  pdf?: Buffer;
  requirements?: BenefitsPackageRequirements;
  requireRegistryEnforcement?: boolean;
}): Promise<QualityReport> {
  const issues: QualityIssue[] = [];
  if (requireRegistryEnforcement) {
    if (!requirements || !requirements.registryVersion)
      issues.push({
        code: "missing_requirement_artifacts",
        message: "The booklet has no canonical benefit-requirements sidecar.",
        blocking: true,
      });
    for (
      const subject of requirements?.subjects.filter(
        (item) => item.enforcementStatus !== "registry_enforced",
      ) || []
    )
      issues.push({
        code: "legacy_unenforced_subject",
        message: `${subject.displayName} is still legacy-unenforced.`,
        blocking: true,
      });
    for (
      const report of requirements?.safeBookletReports.filter(
        (item) => !item.passed,
      ) || []
    )
      issues.push({
        code: "safe_booklet_gate_failed",
        message: `${report.benefitType} subject ${report.subjectId} failed the safe-booklet gate: ${report.issues.map((item) => item.blockerCode || item.code).join(", ")}.`,
        blocking: true,
      });
    const manifestFields = requirements?.renderManifest?.sections.flatMap(
      (section) => section.fields,
    ) || [];
    const manifestKeys = new Set(
      manifestFields.map((field) => `${field.subjectId}:${field.path}`),
    );
    for (const [subjectId, paths] of Object.entries(
      requirements?.renderedPathsBySubject || {},
    ))
      for (const path of paths)
        if (!manifestKeys.has(`${subjectId}:${path}`))
          issues.push({
            code: "rendered_path_not_in_manifest",
            message: `${subjectId} rendered ${path} without manifest approval.`,
            blocking: true,
          });
    for (const field of manifestFields)
      if (!field.evidenceIds.length)
        issues.push({
          code: "manifest_field_missing_evidence",
          message: `${field.requirementId} has no evidence in the render manifest.`,
          blocking: true,
        });
    for (const claim of requirements?.claims || []) {
      for (const path of claim.sourcePaths)
        if (!manifestKeys.has(`${claim.subjectId}:${path}`))
          issues.push({
            code: "claim_path_not_in_manifest",
            message: `A generated claim cites unavailable path ${path} for ${claim.subjectId}.`,
            blocking: true,
          });
      const availableEvidence = new Set(
        manifestFields
          .filter((field) => field.subjectId === claim.subjectId)
          .flatMap((field) => field.evidenceIds),
      );
      for (const evidenceId of claim.evidenceIds)
        if (!availableEvidence.has(evidenceId))
          issues.push({
            code: "claim_evidence_not_in_manifest",
            message: `A generated claim cites unavailable evidence ${evidenceId}.`,
            blocking: true,
          });
    }
  }
  for (const [field, value] of [
    ["planYear.start", benefitsPackage.planYear.start],
    ["planYear.end", benefitsPackage.planYear.end],
  ] as const) {
    if (!value || Number.isNaN(new Date(value).getTime()))
      issues.push({
        code: "invalid_plan_year",
        message: `${field} is not a valid date.`,
        blocking: true,
      });
  }
  for (const id of requiredSections) {
    if (!outline.sections.some((section) => section.id === id))
      issues.push({ code: "missing_section", message: `Required section ${id} is missing.`, blocking: true });
  }
  for (const offering of benefitsPackage.offeredBenefits.filter((item) => item.offered)) {
    if (!outline.sections.some((section) => section.benefitType === offering.benefitType))
      issues.push({
        code: "offering_outline_mismatch",
        message: `${offering.benefitType} is offered but has no booklet section.`,
        blocking: true,
      });
  }
  if (questions.some((question) => question.blocking))
    issues.push({
      code: "unresolved_questions",
      message: `${questions.filter((question) => question.blocking).length} blocking question(s) remain unresolved.`,
      blocking: true,
    });
  for (const path of ["employer.name", "planYear.start", "planYear.end"]) {
    if (!(benefitsPackage.sourceMap[path] || []).length)
      issues.push({
        code: "missing_source",
        message: `${path} has no source reference or manual answer.`,
        blocking: true,
      });
  }
  if (html) {
    const placeholder = html.match(
      /\b(?:placeholder|example\.com|pending confirmation|to be confirmed|not set|not specified|not provided|invalid date|lorem ipsum)\b/i,
    );
    if (placeholder)
      issues.push({
        code: "placeholder_text",
        message: `Generated content still contains placeholder text: ${placeholder[0]}.`,
        blocking: true,
      });
    if (!html.includes(benefitsPackage.employer.name))
      issues.push({
        code: "missing_employer",
        message: "Generated content does not contain the employer name.",
        blocking: true,
      });
    for (const plan of benefitsPackage.plans) {
      if (!html.includes(plan.name))
        issues.push({
          code: "missing_plan",
          message: `Generated content does not contain ${plan.name}.`,
          blocking: true,
        });
    }
    const renderedPageIds = [
      ...html.matchAll(/data-page-id=["']([^"']+)["']/g),
    ].map((match) => match[1]);
    for (const section of outline.sections) {
      const expectedId = section.id === "enrollment" ? "open-enrollment" : section.id;
      if (
        !renderedPageIds.some(
          (pageId) => pageId === expectedId || pageId.startsWith(`${expectedId}-`),
        )
      )
        issues.push({
          code: "missing_rendered_section",
          message: `Outlined section ${section.id} did not render a PDF page.`,
          blocking: true,
        });
    }
  }
  let pageCount: number | undefined;
  if (pdf) {
    try {
      const parsed = await PDFDocument.load(pdf);
      pageCount = parsed.getPageCount();
      if (pageCount < 6 || pageCount > 80)
        issues.push({
          code: "page_count",
          message: `Generated PDF has an unexpected page count (${pageCount}).`,
          blocking: true,
        });
      for (const [index, page] of parsed.getPages().entries()) {
        const { width, height } = page.getSize();
        if (Math.abs(width - 612) > 2 || Math.abs(height - 792) > 2)
          issues.push({
            code: "page_size",
            message: `PDF page ${index + 1} is not US Letter size.`,
            blocking: true,
          });
      }
    } catch (error) {
      issues.push({
        code: "invalid_pdf",
        message: error instanceof Error ? error.message : "Generated PDF is invalid.",
        blocking: true,
      });
    }
  }
  return {
    passed: !issues.some((issue) => issue.blocking),
    issues,
    pageCount,
  };
}
