import fs from "node:fs/promises";
import path from "node:path";
import * as XLSX from "xlsx";
import { describe, expect, it } from "vitest";
import type { LoadedUploadedFile } from "../lib/booklet-types";
import { extractRateSheet, normalizeTier } from "../lib/rate-sheet-extractor";

async function fixture(name: string): Promise<LoadedUploadedFile> {
  return {
    id: name,
    companyId: "fixture",
    fileName: name,
    storagePath: `notion-call-transcripts/${name}`,
    mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    uploadedAt: "2026-07-17T00:00:00.000Z",
    sha256: "fixture",
    processingStatus: "uploaded",
    data: await fs.readFile(path.join(process.cwd(), "notion-call-transcripts", name)),
  };
}

function memoryWorkbook(rows: unknown[][]): LoadedUploadedFile {
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(rows), "Sheet1");
  return {
    id: "memory",
    companyId: "fixture",
    fileName: "memory.xlsx",
    storagePath: "memory.xlsx",
    mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    uploadedAt: "2026-07-17T00:00:00.000Z",
    sha256: "fixture",
    processingStatus: "uploaded",
    data: Buffer.from(XLSX.write(workbook, { type: "buffer", bookType: "xlsx" })),
  };
}

describe("rate sheet extractor", () => {
  it.each([
    ["EE", "employee"],
    ["Single", "employee"],
    ["Employee", "employee"],
    ["Subscriber & Spouse", "employee_spouse"],
    ["EE+Children", "employee_children"],
    ["Family", "family"],
    ["Custom Class", "custom_class"],
  ])("normalizes %s coverage tiers", (input, expected) => {
    expect(normalizeTier(input)).toBe(expected);
  });

  it.each([
    ["1st quarter 2026 Excellus rates.xlsx", "01/01/2026", "Q1"],
    ["3rd quarter 2026 Excellus rates.xlsx", "07/01/2026", "Q3"],
    ["4th quarter 2026 Excellus rates.xlsx", "10/01/2026", "Q4"],
  ])("extracts plan catalogs from %s", async (name, effectiveDate, quarter) => {
    const result = extractRateSheet(await fixture(name));
    expect(result.plans).toHaveLength(23);
    expect(result.plans[0]).toMatchObject({
      sourceSheet: "Worksheet",
      effectiveDate,
      quarter,
      employerSpecific: false,
    });
    expect(result.plans[0].tiers).toHaveLength(4);
  });

  it("extracts Healthy NY and Excellus plan tables from the multi-sheet renewal workbook", async () => {
    const result = extractRateSheet(
      await fixture("2026 1st quarter renewal rates with Healthy NY.xlsx"),
    );
    expect(result.plans.length).toBeGreaterThanOrEqual(45);
    expect(
      result.plans.some((plan) => /Healthy (?:NY|New York)/i.test(plan.planName)),
    ).toBe(true);
    expect(result.plans.every((plan) => plan.sourceRow > 0)).toBe(true);
  });

  it("finds dental plans in the employer cost workbook", async () => {
    const result = extractRateSheet(
      await fixture("ER and EE cost per month spreadsheet.xlsx"),
    );
    const dental = result.plans.filter((plan) => plan.benefitType === "dental");
    expect(dental.length).toBeGreaterThan(0);
    expect(dental.some((plan) => /Excellus Dental/i.test(plan.planName))).toBe(true);
  });

  it("does not trust a percentage column when it conflicts with the employer cost", async () => {
    const result = extractRateSheet(
      await fixture("ER and EE cost per month spreadsheet.xlsx"),
    );
    const percentageRules = result.contributions.filter(
      (rule) => rule.sourceRefs[0]?.sheet === "24 pays precentage",
    );
    expect(percentageRules.length).toBeGreaterThan(0);
    expect(percentageRules.every((rule) => rule.mode === "flat_monthly")).toBe(true);
  });

  it("uses percentage mode when the stated percent reconciles to employer cost", () => {
    const result = extractRateSheet(
      memoryWorkbook([
        ["Plan", "Tier", "Monthly Premium", "ER Cost", "EE Cost", "ER %"],
        ["Plan A", "EE", 1000, 600, 400, "60%"],
        [null, "EE+Spouse", 2000, 1000, 1000, "50%"],
        [null, "EE+Children", 1700, 850, 850, "50%"],
        [null, "Family", 2800, 1400, 1400, "50%"],
      ]),
    );
    expect(result.contributions.every((rule) => rule.mode === "percent")).toBe(true);
  });

  it("detects flat-dollar contribution sheets", async () => {
    const result = extractRateSheet(
      await fixture("ER and EE cost per month spreadsheet.xlsx"),
    );
    const flatRules = result.contributions.filter(
      (rule) => rule.sourceRefs[0]?.sheet === "24 pays flat dollar",
    );
    expect(flatRules.length).toBeGreaterThan(0);
    expect(flatRules.every((rule) => rule.mode === "flat_monthly")).toBe(true);
    expect(flatRules.every((rule) => rule.payPeriods === 24)).toBe(true);
  });

  it("preserves sheet and row provenance on premiums", async () => {
    const result = extractRateSheet(
      await fixture("1st quarter 2026 Excellus rates.xlsx"),
    );
    expect(result.facts[0]).toMatchObject({
      extractionMethod: "spreadsheet",
      source: { fileName: "1st quarter 2026 Excellus rates.xlsx", sheet: "Worksheet" },
    });
    expect(result.facts.some((fact) => fact.source.row && fact.source.row > 0)).toBe(true);
  });

  it("returns a warning for an unsupported workbook layout", () => {
    const result = extractRateSheet(memoryWorkbook([["Notes"], ["Nothing to parse"]]));
    expect(result.plans).toEqual([]);
    expect(result.warnings).toHaveLength(1);
  });
});
