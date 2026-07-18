import { PDFDocument } from "pdf-lib";
import type {
  BenefitsPackage,
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
}: {
  benefitsPackage: BenefitsPackage;
  outline: BookletOutline;
  questions?: BlockerQuestion[];
  html?: string;
  pdf?: Buffer;
}): Promise<QualityReport> {
  const issues: QualityIssue[] = [];
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
      /\b(?:placeholder|example\.com|pending confirmation|to be confirmed|not set|invalid date|lorem ipsum)\b/i,
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
