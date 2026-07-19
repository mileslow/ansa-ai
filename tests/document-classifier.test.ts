import * as XLSX from "xlsx";
import { describe, expect, it } from "vitest";
import {
  classifyDocument,
  classifyDocumentWithFallback,
} from "../lib/document-classifier";
import type { LoadedUploadedFile } from "../lib/booklet-types";

function file(
  fileName: string,
  mimeType = "application/pdf",
  textContent = "",
  data = Buffer.from("fixture"),
): LoadedUploadedFile {
  return {
    id: fileName,
    companyId: "company",
    fileName,
    storagePath: `fixtures/${fileName}`,
    mimeType,
    uploadedAt: "2026-07-17T00:00:00.000Z",
    sha256: "fixture",
    processingStatus: "uploaded",
    data,
    textContent,
  };
}

function workbook(rows: unknown[][]) {
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet(rows), "Rates");
  return Buffer.from(XLSX.write(book, { type: "buffer", bookType: "xlsx" }));
}

describe("document classifier", () => {
  it.each([
    [
      file("Employer application.pdf", "application/pdf", "New Group Application"),
      "employer_application",
    ],
    [
      file("current.sbc.pdf", "application/pdf", "Summary of Benefits and Coverage"),
      "sbc",
    ],
    [
      file("plan.pdf", "application/pdf", "Summary Plan Description"),
      "spd",
    ],
    [
      file("medical-plan.pdf", "application/pdf", "Benefit Plan Summary"),
      "plan_summary",
    ],
    [file("yale_employer_administered_std_plan.pdf"), "spd"],
    [file("2026_hsa_contribution_change_form.pdf"), "plan_summary"],
    [file("2025 prior benefit booklet.pdf"), "prior_booklet"],
    [file("2025 Benefit Guide.pdf"), "benefit_guide"],
    [file("broker-thread.eml", "message/rfc822"), "email_export"],
    [file("notes.txt", "text/plain", "Unrelated meeting notes"), "unknown"],
  ] as const)("classifies $fileName as %s", (input, expected) => {
    expect(classifyDocument(input).documentType).toBe(expected);
  });

  it("classifies a carrier rate workbook from its headers", () => {
    const input = file(
      "rates.xlsx",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "",
      workbook([["Plan Name", "Single Rate", "Family Rate"]]),
    );
    expect(classifyDocument(input)).toMatchObject({
      documentType: "carrier_rate_sheet",
      confidence: 0.93,
    });
  });

  it("routes a prescription formulary into the medical extraction contract", () => {
    expect(
      classifyDocument(
        file(
          "july-2026-formulary.pdf",
          "application/pdf",
          "CVS Caremark Performance Drug List. Prescription drug formulary.",
        ),
      ),
    ).toMatchObject({
      documentType: "plan_summary",
      benefitTypes: ["medical"],
      scope: "generic_reference",
      authority: "administrator_material",
      documentSubtype: "prescription_formulary",
    });
  });

  it("normalizes a recognized insurance certificate into the coarse SPD role", async () => {
    const input = file("certificate.pdf");
    const parse = async () => ({
      output_parsed: {
        documentType: "unknown",
        confidence: 0.95,
        detectedBenefitTypes: ["life"],
        detectedEmployer: "City of Seattle",
        detectedCarrier: "Securian",
        detectedPlanYear: "2021",
        reasoningSummary: "A current group AD&D certificate of insurance.",
        benefitTypes: ["life"],
        documentSubtype: "group AD&D certificate of insurance",
        scope: "current_employer",
        authority: "current_plan_document",
        employerOrGroupId: "City of Seattle",
        planOrProgramIds: ["70468"],
        effectiveStart: "2021-01-01",
        effectiveEnd: null,
      },
    });
    await expect(
      classifyDocumentWithFallback({
        file: input,
        apiKey: "test",
        client: { responses: { parse } } as any,
      }),
    ).resolves.toMatchObject({
      documentType: "spd",
      documentSubtype: "group AD&D certificate of insurance",
      benefitTypes: ["life"],
      authority: "current_plan_document",
    });
  });

  it("classifies a renewal workbook before generic carrier rates", () => {
    const input = file(
      "2026 renewal.xlsx",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "",
      workbook([["2025 vs 2026"], ["Plan", "Tier", "Monthly Premium", "ER Cost"]]),
    );
    expect(classifyDocument(input).documentType).toBe("renewal_spreadsheet");
  });

  it("classifies CSV rate input", () => {
    const input = file(
      "carrier-rates.csv",
      "text/csv",
      "Plan Name,Single Rate,Family Rate",
      Buffer.from("Plan Name,Single Rate,Family Rate\nPlan A,500,1400"),
    );
    expect(classifyDocument(input).documentType).toBe("carrier_rate_sheet");
  });

  it("classifies employee census headers", () => {
    const input = file(
      "employees.xlsx",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "",
      workbook([["Employee Name", "Date of Birth", "Tier"]]),
    );
    expect(classifyDocument(input).documentType).toBe("census");
  });

  it("extracts employer, carrier, and plan-year hints", () => {
    const result = classifyDocument(
      file(
        "2026 employer application.pdf",
        "application/pdf",
        "Group/Business Name: Acme Manufacturing\nCarrier: Excellus",
      ),
    );
    expect(result.detectedEmployer).toBe("Acme Manufacturing");
    expect(result.detectedCarrier).toBe("Excellus");
    expect(result.detectedPlanYear).toBe("2026");
    expect(result).toMatchObject({
      scope: "current_employer",
      authority: "employer_selection",
      effectiveStart: "2026-01-01",
      effectiveEnd: "2026-12-31",
    });
  });

  it("keeps classification role, benefit family, scope, and authority orthogonal", () => {
    expect(
      classifyDocument(
        file(
          "carrier-product-flyer.pdf",
          "application/pdf",
          "Generic overview marketing brochure for a dental DHMO",
        ),
      ),
    ).toMatchObject({
      documentType: "plan_summary",
      benefitTypes: ["dental"],
      scope: "generic_reference",
      authority: "generic_marketing",
    });
  });

  it("does not activate standalone pediatric benefits from a medical SBC", () => {
    const result = classifyDocument(
      file(
        "medical.sbc.pdf",
        "application/pdf",
        "Summary of Benefits and Coverage. Medical health coverage includes pediatric dental and pediatric vision EHB rows.",
      ),
    );
    expect(result.documentType).toBe("sbc");
    expect(result.benefitTypes).toContain("medical");
    expect(result.benefitTypes).not.toContain("dental");
    expect(result.benefitTypes).not.toContain("vision");
  });

  it("does not crash on an invalid workbook", () => {
    const result = classifyDocument(
      file(
        "broken.xlsx",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "",
        Buffer.from("not a workbook"),
      ),
    );
    expect(["unknown", "carrier_rate_sheet"]).toContain(result.documentType);
  });

  it("preserves first-class website and thread-message provenance", () => {
    expect(
      classifyDocument({
        ...file("company-website-evidence.txt", "text/plain", '{"name":"Acme"}'),
        sourceKind: "company_website",
        sourceUrl: "https://acme.example",
      }).documentType,
    ).toBe("company_website");
    expect(
      classifyDocument({
        ...file("booklet-thread-instructions.txt", "text/plain", "Use the final rates."),
        sourceKind: "thread_message",
      }).documentType,
    ).toBe("email_export");
  });
});
