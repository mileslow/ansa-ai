import { PDFDocument } from "pdf-lib";
import { describe, expect, it } from "vitest";
import { checkBookletQuality } from "../lib/booklet-quality-checker";
import type {
  BenefitsPackage,
  BenefitsPackageRequirements,
  BlockerQuestion,
  BookletOutline,
  SourceRef,
} from "../lib/booklet-types";

const source: SourceRef = {
  fileId: "source",
  fileName: "source.pdf",
  documentType: "employer_application",
  page: 1,
  extractionMethod: "pdf_text",
};

function benefitsPackage(): BenefitsPackage {
  return {
    employer: { name: "Acme Manufacturing" },
    planYear: { start: "2026-01-01", end: "2026-12-31", label: "2026" },
    eligibility: { waitingPeriod: "First of month after 30 days", employeeClasses: [] },
    offeredBenefits: [
      {
        benefitType: "medical",
        offered: true,
        selectedPlans: ["plan"],
        contributionRules: [],
        contacts: [],
        sourceRefs: [source],
        confidence: 0.95,
      },
    ],
    plans: [
      {
        id: "plan",
        benefitType: "medical",
        name: "Acme Gold",
        ratePlanId: "rate",
        sourceRefs: [source],
        confidence: 0.95,
      },
    ],
    rates: [],
    contributions: [],
    contacts: [],
    accounts: [],
    bookletStyle: { sectionOrder: [], sourceRefs: [] },
    sourceMap: {
      "employer.name": [source],
      "planYear.start": [source],
      "planYear.end": [source],
      "eligibility.waitingPeriod": [source],
    },
    confidenceReport: {
      overall: 0.95,
      fields: {},
      sources: [source],
      warnings: [],
      assumptions: [],
      conflicts: [],
      manualAnswers: [],
    },
  };
}

function outline(): BookletOutline {
  return {
    sections: [
      "cover",
      "toc",
      "welcome",
      "eligibility",
      "enrollment",
      "medical",
      "contacts",
      "legal",
    ].map((id) => ({
      id,
      title: id,
      benefitType: id === "medical" ? "medical" : undefined,
      sourceRefs: [source],
    })),
  };
}

function validHtml() {
  return `${outline()
    .sections.map(
      (section) =>
        `<section data-page-id="${section.id === "enrollment" ? "open-enrollment" : section.id}"></section>`,
    )
    .join("")}<h1>Acme Manufacturing</h1><p>Acme Gold</p>`;
}

async function pdf(pageCount = 6, size: [number, number] = [612, 792]) {
  const document = await PDFDocument.create();
  for (let index = 0; index < pageCount; index += 1) document.addPage(size);
  return Buffer.from(await document.save());
}

describe("booklet quality checker", () => {
  it("passes a valid package, outline, HTML, and PDF", async () => {
    const report = await checkBookletQuality({
      benefitsPackage: benefitsPackage(),
      outline: outline(),
      html: validHtml(),
      pdf: await pdf(),
    });
    expect(report).toMatchObject({ passed: true, pageCount: 6, issues: [] });
  });

  it.each(["cover", "toc", "welcome", "eligibility", "enrollment", "contacts", "legal"])(
    "rejects a missing %s section",
    async (sectionId) => {
      const changed = outline();
      changed.sections = changed.sections.filter((section) => section.id !== sectionId);
      const report = await checkBookletQuality({
        benefitsPackage: benefitsPackage(),
        outline: changed,
      });
      expect(report.issues.some((issue) => issue.code === "missing_section")).toBe(true);
    },
  );

  it("rejects an offered benefit missing from the outline", async () => {
    const changed = outline();
    changed.sections = changed.sections.filter((section) => section.id !== "medical");
    const report = await checkBookletQuality({ benefitsPackage: benefitsPackage(), outline: changed });
    expect(report.issues.some((issue) => issue.code === "offering_outline_mismatch")).toBe(
      true,
    );
  });

  it("rejects unresolved blocker questions", async () => {
    const blocker: BlockerQuestion = {
      id: "q",
      fieldPath: "employer.name",
      question: "Employer?",
      reason: "Missing",
      sourceRefs: [],
      blocking: true,
    };
    const report = await checkBookletQuality({
      benefitsPackage: benefitsPackage(),
      outline: outline(),
      questions: [blocker],
    });
    expect(report.issues.some((issue) => issue.code === "unresolved_questions")).toBe(true);
  });

  it.each(["employer.name", "planYear.start", "planYear.end"])(
    "rejects missing source provenance for %s",
    async (path) => {
      const changed = benefitsPackage();
      changed.sourceMap[path] = [];
      const report = await checkBookletQuality({ benefitsPackage: changed, outline: outline() });
      expect(report.issues.some((issue) => issue.code === "missing_source")).toBe(true);
    },
  );

  it.each([
    "Placeholder",
    "example.com",
    "pending confirmation",
    "to be confirmed",
    "Not set",
    "Not specified",
    "Not provided",
    "Lorem ipsum",
  ])("rejects placeholder HTML containing %s", async (placeholder) => {
    const report = await checkBookletQuality({
      benefitsPackage: benefitsPackage(),
      outline: outline(),
      html: `<h1>Acme Manufacturing</h1><p>Acme Gold ${placeholder}</p>`,
    });
    expect(report.issues.some((issue) => issue.code === "placeholder_text")).toBe(true);
  });

  it("rejects HTML missing the employer name", async () => {
    const report = await checkBookletQuality({
      benefitsPackage: benefitsPackage(),
      outline: outline(),
      html: validHtml().replace("Acme Manufacturing", ""),
    });
    expect(report.issues.some((issue) => issue.code === "missing_employer")).toBe(true);
  });

  it("rejects HTML missing a selected plan", async () => {
    const report = await checkBookletQuality({
      benefitsPackage: benefitsPackage(),
      outline: outline(),
      html: validHtml().replace("Acme Gold", ""),
    });
    expect(report.issues.some((issue) => issue.code === "missing_plan")).toBe(true);
  });

  it("rejects an outlined section that did not render", async () => {
    const report = await checkBookletQuality({
      benefitsPackage: benefitsPackage(),
      outline: outline(),
      html: validHtml().replace('data-page-id="medical"', 'data-page-id="missing-medical"'),
    });
    expect(report.issues.some((issue) => issue.code === "missing_rendered_section")).toBe(
      true,
    );
  });

  it("rejects an invalid PDF", async () => {
    const report = await checkBookletQuality({
      benefitsPackage: benefitsPackage(),
      outline: outline(),
      pdf: Buffer.from("not a pdf"),
    });
    expect(report.issues.some((issue) => issue.code === "invalid_pdf")).toBe(true);
  });

  it("rejects non-date plan year values before rendering", async () => {
    const changed = benefitsPackage();
    changed.planYear.start = "Unknown";
    const report = await checkBookletQuality({ benefitsPackage: changed, outline: outline() });
    expect(report.issues.some((issue) => issue.code === "invalid_plan_year")).toBe(true);
  });

  it("rejects Invalid Date text in rendered HTML", async () => {
    const report = await checkBookletQuality({
      benefitsPackage: benefitsPackage(),
      outline: outline(),
      html: `${validHtml()}<p>Invalid Date to Invalid Date</p>`,
    });
    expect(report.issues.some((issue) => issue.code === "placeholder_text")).toBe(true);
  });

  it("rejects an unexpected PDF page count", async () => {
    const report = await checkBookletQuality({
      benefitsPackage: benefitsPackage(),
      outline: outline(),
      pdf: await pdf(2),
    });
    expect(report.issues.some((issue) => issue.code === "page_count")).toBe(true);
  });

  it("rejects non-letter PDF pages", async () => {
    const report = await checkBookletQuality({
      benefitsPackage: benefitsPackage(),
      outline: outline(),
      pdf: await pdf(6, [595, 842]),
    });
    expect(report.issues.some((issue) => issue.code === "page_size")).toBe(true);
  });

  it("rejects failed registry gates and claims outside the render manifest", async () => {
    const requirements = {
      registryVersion: "test",
      subjects: [
        {
          id: "medical-plan",
          benefitType: "medical",
          entityKind: "plan",
          displayName: "Acme Gold",
          employerOrGroupId: "acme",
          resolutions: {},
          enforcementStatus: "registry_enforced",
        },
      ],
      extractionReports: [],
      safeBookletReports: [
        {
          subjectId: "medical-plan",
          benefitType: "medical",
          gate: "safe_booklet",
          passed: false,
          applicableRequirementIds: ["medical.identity.planName"],
          issues: [
            {
              requirementId: "medical.identity.planName",
              path: "plans.medical.identity.planName",
              code: "missing",
              message: "Plan name is unresolved.",
            },
          ],
        },
      ],
      renderedPathsBySubject: {
        "medical-plan": ["plans.medical.identity.carrierOrAdministrator"],
      },
      renderManifest: {
        sections: [
          {
            id: "medical",
            subjectIds: ["medical-plan"],
            fields: [
              {
                subjectId: "medical-plan",
                requirementId: "medical.identity.planName",
                path: "plans.medical.identity.planName",
                value: "Acme Gold",
                evidenceIds: ["evidence-1"],
              },
            ],
          },
        ],
      },
      claims: [
        {
          text: "Unsupported carrier claim",
          subjectId: "medical-plan",
          requirementIds: ["medical.identity.carrierOrAdministrator"],
          sourcePaths: ["plans.medical.identity.carrierOrAdministrator"],
          evidenceIds: ["not-in-manifest"],
        },
      ],
    } satisfies BenefitsPackageRequirements;
    const report = await checkBookletQuality({
      benefitsPackage: benefitsPackage(),
      outline: outline(),
      requirements,
      requireRegistryEnforcement: true,
    });
    expect(report.issues.map((issue) => issue.code)).toEqual(
      expect.arrayContaining([
        "safe_booklet_gate_failed",
        "rendered_path_not_in_manifest",
        "claim_path_not_in_manifest",
        "claim_evidence_not_in_manifest",
      ]),
    );
  });
});
