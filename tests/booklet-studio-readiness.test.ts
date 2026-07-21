import { describe, expect, it } from "vitest";
import {
  bookletStudioOutputMode,
  bookletStudioPhaseFromUrl,
  bookletStudioSourcePhaseCompletion,
  bookletStudioSetupComplete,
  mergeBookletClassifications,
  mergeBookletFiles,
  reconcileRequiredPlanUploads,
  requiredPlanUploadStatus,
  requiredPlanUploadsComplete,
  requiredPlanUploadsFromFacts,
} from "../src/bookletStudioReadiness";

const source = (id: string, intakeCategory: string) => ({ id, intakeCategory });

describe("Booklet Studio output readiness", () => {
  it("restores a valid saved phase and safely defaults invalid URL state", () => {
    expect(bookletStudioPhaseFromUrl("instructions")).toBe("instructions");
    expect(bookletStudioPhaseFromUrl("documents")).toBe("documents");
    expect(bookletStudioPhaseFromUrl("not-a-phase")).toBe("employer");
    expect(bookletStudioPhaseFromUrl(null)).toBe("employer");
  });

  it("keeps automatic frontend runs HTML-only until every setup phase is present", () => {
    const incomplete = [
      source("employer", "employer"),
      source("plans", "documents"),
      source("rates", "rates"),
    ];

    expect(bookletStudioOutputMode(incomplete)).toBe("html_preview");
    expect(
      bookletStudioOutputMode([
        ...incomplete,
        source("instructions", "instructions"),
      ]),
    ).toBe("final_pdf");
  });

  it("retains earlier phase files when the frontend receives a later upload response", () => {
    const files = mergeBookletFiles(
      [source("employer", "employer")],
      [source("plans", "documents")],
    );

    expect(files.map((file) => file.id)).toEqual(["employer", "plans"]);
  });

  it("does not regress verified plan matches during a provisional rerun", () => {
    const verified = {
      fileId: "medical-file",
      documentType: "plan_summary",
      confidence: 0.99,
      planOrProgramIds: ["2026 SimplyBlue Plus Bronze 4"],
      detectedBenefitTypes: ["medical"],
      provisional: false,
    };
    const provisional = {
      fileId: "medical-file",
      documentType: "plan_summary",
      confidence: 0.88,
      planOrProgramIds: [],
      detectedBenefitTypes: ["medical"],
      provisional: true,
    };
    const newlyUploaded = {
      fileId: "rate-file",
      documentType: "carrier_rate_sheet",
      confidence: 0.94,
      provisional: true,
    };

    expect(mergeBookletClassifications(
      [verified],
      [provisional, newlyUploaded],
    )).toEqual([
      verified,
      newlyUploaded,
    ]);
  });

  it("turns employer extraction facts into a concrete plan-document checklist", () => {
    const facts = [
      { path: "offeredBenefits[0].medical", value: true, fileId: "employer", confidence: 0.99 },
      { path: "offeredBenefits[1].dental", value: true, fileId: "employer", confidence: 0.98 },
      { path: "offeredBenefits[2].hsa", value: true, fileId: "employer", confidence: 0.97 },
      { path: "selectedPlans[0].planName", value: "Pioneer PPO 1500 HSA", fileId: "employer", confidence: 0.99 },
      { path: "selectedPlans[1].planName", value: "Summit DPPO", fileId: "employer", confidence: 0.98 },
    ];

    expect(requiredPlanUploadsFromFacts(facts)).toEqual([
      expect.objectContaining({
        benefitType: "medical",
        planName: "Pioneer PPO 1500 HSA",
        documentLabel: "SBC and medical plan summary or SPD",
      }),
      expect.objectContaining({
        benefitType: "dental",
        planName: "Summit DPPO",
      }),
      expect.objectContaining({
        benefitType: "hsa",
        planName: null,
      }),
    ]);
  });

  it("checks off plan requirements from uploaded plan extraction without restricting uploads", () => {
    const requirements = requiredPlanUploadsFromFacts([
      { path: "offeredBenefits[0].medical", value: true, fileId: "employer", confidence: 0.99 },
      { path: "offeredBenefits[1].dental", value: true, fileId: "employer", confidence: 0.98 },
      { path: "selectedPlans[0].planName", value: "Pioneer PPO 1500 HSA", fileId: "employer", confidence: 0.99 },
      { path: "selectedPlans[1].planName", value: "Summit DPPO", fileId: "employer", confidence: 0.98 },
    ]);
    const files = [
      { id: "medical-file", fileName: "pioneer-sbc.pdf" },
      { id: "dental-file", fileName: "dental-summary.pdf" },
      { id: "unrelated-file", fileName: "notes.txt" },
    ];
    const reconciled = reconcileRequiredPlanUploads(
      requirements,
      files,
      [{
        fileId: "medical-file",
        path: "plan.identity",
        value: { planName: "Pioneer PPO 1500 HSA" },
      }],
      [{
        fileId: "dental-file",
        detectedBenefitTypes: ["dental"],
        planOrProgramIds: ["Summit DPPO"],
      }],
    );

    expect(reconciled).toEqual([
      expect.objectContaining({ benefitType: "medical", complete: true, matchedFileId: "medical-file" }),
      expect.objectContaining({ benefitType: "dental", complete: true, matchedFileId: "dental-file" }),
    ]);
    expect(files).toHaveLength(3);
    expect(requiredPlanUploadsComplete(reconciled)).toBe(true);
  });

  it("does not let one type-only document satisfy multiple named plans", () => {
    const requirements = [
      { id: "one", benefitType: "medical", planName: "Plan One" },
      { id: "two", benefitType: "medical", planName: "Plan Two" },
    ];
    const reconciled = reconcileRequiredPlanUploads(
      requirements,
      [{ id: "medical-file", fileName: "medical.pdf" }],
      [],
      [{ fileId: "medical-file", detectedBenefitTypes: ["medical"] }],
    );

    expect(reconciled.every((item) => item.complete === false)).toBe(true);
    expect(requiredPlanUploadsComplete(reconciled)).toBe(false);
  });

  it("does not confuse similarly named plan options", () => {
    const requirements = [
      { id: "basic", benefitType: "dental", planName: "2026 Delta Dental Basic Family PPO Plan I" },
      { id: "enhanced", benefitType: "dental", planName: "2026 Delta Dental Enhanced Family PPO Plan III" },
    ];
    const files = [
      { id: "basic-file", fileName: "basic.pdf" },
      { id: "enhanced-file", fileName: "enhanced.pdf" },
    ];
    const reconciled = reconcileRequiredPlanUploads(requirements, files, [], [
      { fileId: "basic-file", detectedBenefitTypes: ["dental"], planOrProgramIds: [requirements[0].planName] },
      { fileId: "enhanced-file", detectedBenefitTypes: ["dental"], planOrProgramIds: [requirements[1].planName] },
    ]);

    expect(reconciled).toEqual([
      expect.objectContaining({ id: "basic", matchedFileId: "basic-file" }),
      expect.objectContaining({ id: "enhanced", matchedFileId: "enhanced-file" }),
    ]);
  });

  it("shows an exact filename match as received while backend verification is pending", () => {
    const [requirement] = reconcileRequiredPlanUploads(
      [{ id: "bronze", benefitType: "medical", planName: "2026 SimplyBlue Plus Bronze 4" }],
      [{ id: "bronze-file", fileName: "northstar_2026_simplyblue-plus-bronze-4_sbc.pdf" }],
      [],
      [],
    );

    expect(requirement).toMatchObject({
      complete: false,
      uploaded: true,
      uploadedFileId: "bronze-file",
    });
  });

  it("shows only the matched uploaded plan as parsing until that file finishes", () => {
    const parsing = {
      complete: true,
      uploaded: true,
      matchedFileId: "bronze-file",
      uploadedFileId: "bronze-file",
    };
    const complete = {
      complete: true,
      uploaded: true,
      matchedFileId: "silver-file",
      uploadedFileId: "silver-file",
    };

    expect(requiredPlanUploadStatus(parsing, new Set(["bronze-file"]))).toBe("parsing");
    expect(requiredPlanUploadStatus(complete, new Set(["bronze-file"]))).toBe("complete");
  });

  it("only marks the full setup ready when every elected plan is matched", () => {
    const files = [
      { id: "employer", intakeCategory: "employer", fileName: "employer.pdf" },
      { id: "basic", intakeCategory: "documents", fileName: "basic.pdf" },
      { id: "enhanced", intakeCategory: "documents", fileName: "enhanced.pdf" },
      { id: "rates", intakeCategory: "rates", fileName: "rates.xlsx" },
    ];
    const employerFacts = [
      { fileId: "employer", path: "offeredBenefits[0].dental", value: true, confidence: 0.99 },
      { fileId: "employer", path: "offeredBenefits[1].dental", value: true, confidence: 0.99 },
      { fileId: "employer", path: "selectedPlans[0].planName", value: "Basic Dental", confidence: 0.99 },
      { fileId: "employer", path: "selectedPlans[1].planName", value: "Enhanced Dental", confidence: 0.99 },
      { fileId: "rates", path: "rates[0]", value: { planName: "Basic Dental" }, confidence: 0.99 },
    ];
    const basicClassification = {
      fileId: "basic",
      detectedBenefitTypes: ["dental"],
      planOrProgramIds: ["Basic Dental"],
    };
    const enhancedClassification = {
      fileId: "enhanced",
      detectedBenefitTypes: ["dental"],
      planOrProgramIds: ["Enhanced Dental"],
    };

    expect(bookletStudioSetupComplete(files, [basicClassification], employerFacts, [])).toBe(false);
    expect(bookletStudioSetupComplete(
      files,
      [basicClassification, enhancedClassification],
      employerFacts,
      [],
    )).toBe(true);
    expect(bookletStudioSetupComplete(
      files,
      [basicClassification, enhancedClassification],
      employerFacts,
      [{ id: "missing-detail" }],
    )).toBe(false);
    expect(bookletStudioSourcePhaseCompletion(
      files,
      [basicClassification, enhancedClassification],
      employerFacts,
    )).toEqual({ employer: true, documents: true, rates: true });
  });

  it("keeps completed source phases complete when final follow-up questions remain", () => {
    const files = [
      { id: "employer", intakeCategory: "employer", fileName: "employer.pdf" },
      { id: "plan", intakeCategory: "documents", fileName: "medical.pdf" },
      { id: "rates", intakeCategory: "rates", fileName: "rates.xlsx" },
    ];
    const facts = [
      { fileId: "employer", path: "offeredBenefits[0].medical", value: true, confidence: 0.99 },
      { fileId: "employer", path: "selectedPlans[0].planName", value: "Medical Gold", confidence: 0.99 },
      { fileId: "rates", path: "rates[0]", value: { planName: "Medical Gold" }, confidence: 0.99 },
    ];
    const classifications = [{
      fileId: "plan",
      detectedBenefitTypes: ["medical"],
      planOrProgramIds: ["Medical Gold"],
    }];

    expect(bookletStudioSourcePhaseCompletion(files, classifications, facts)).toEqual({
      employer: true,
      documents: true,
      rates: true,
    });
    expect(bookletStudioSetupComplete(files, classifications, facts, [{ fieldPath: "employer.name" }])).toBe(false);
  });
});
