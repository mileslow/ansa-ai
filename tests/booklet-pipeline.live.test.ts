import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import * as XLSX from "xlsx";
import { describe, expect, it } from "vitest";
import { runBookletPipeline } from "../lib/booklet-pipeline";
import type { LoadedUploadedFile } from "../lib/booklet-types";

const live =
  process.env.RUN_LIVE_BOOKLET_PIPELINE_TESTS === "1" &&
  Boolean(process.env.OPENAI_API_KEY);

function loaded(
  id: string,
  fileName: string,
  mimeType: string,
  data: Buffer,
  textContent?: string,
): LoadedUploadedFile {
  return {
    id,
    companyId: "live-uhc-fixture",
    fileName,
    storagePath: `live-fixture/${fileName}`,
    mimeType,
    uploadedAt: new Date().toISOString(),
    sha256: createHash("sha256").update(data).digest("hex"),
    processingStatus: "uploaded",
    data,
    textContent,
  };
}

function rateWorkbook() {
  const workbook = XLSX.utils.book_new();
  const sheet = XLSX.utils.aoa_to_sheet([
    ["2026 Current Plan Costs"],
    ["Plan", "Tier", "Monthly Premium", "ER Cost", "EE Cost", "EE Per Pay Period", "ER %", "# Enrolled"],
    ["UHC Bronze 2026", "EE", 767.47, 500, 267.47, 123.45, "65%", 8],
    [null, "EE+Spouse", 1534.94, 750, 784.94, 362.28, "49%", 2],
    [null, "EE+Children", 1304.7, 650, 654.7, 302.17, "50%", 1],
    [null, "EE+Family", 2187.29, 1000, 1187.29, 548.0, "46%", 3],
  ]);
  XLSX.utils.book_append_sheet(workbook, sheet, "26 pay periods");
  return Buffer.from(XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }));
}

describe.skipIf(!live)("live benefits booklet agent", () => {
  it(
    "runs a complete mixed-file thread pipeline through model extraction and PDF rendering",
    async () => {
      const plan = await fs.readFile(
        path.join(process.cwd(), "tests/fixtures/plans/uhc-bronze-2026.pdf"),
      );
      const instruction = `Current employer facts for this booklet:
Employer: Northstar Fabrication LLC
Plan year: January 1, 2026 through December 31, 2026
Eligibility: Full-time employees are eligible first of the month after 30 days of employment.
Offered benefits: Medical.
Selected current medical plan: UHC Bronze 2026.
Use the attached current rate/contribution workbook for employee deductions.`;
      const events: string[] = [];
      const result = await runBookletPipeline({
        runId: "live-complete-uhc",
        companyId: "live-uhc-fixture",
        files: [
          loaded(
            "instructions",
            "current-employer-instructions.eml",
            "message/rfc822",
            Buffer.from(instruction),
            instruction,
          ),
          loaded(
            "rates",
            "2026-current-renewal-rates.xlsx",
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            rateWorkbook(),
          ),
          loaded("plan", "uhc-bronze-2026-sbc.pdf", "application/pdf", plan),
        ],
        onEvent: (event) => void events.push(event.stage),
      });
      expect(
        result.status,
        result.status === "blocked"
          ? JSON.stringify(
              result.questions.map((question) => ({
                fieldPath: question.fieldPath,
                reason: question.reason,
              })),
              null,
              2,
            )
          : undefined,
      ).toBe("complete");
      expect(result.questions).toEqual([]);
      expect(result.benefitsPackage.employer.name).toMatch(/Northstar Fabrication/i);
      expect(result.benefitsPackage.plans[0]?.name).toMatch(/UHC Bronze 2026/i);
      expect(result.benefitsPackage.plans[0]?.attributes?.services.length).toBeGreaterThan(15);
      expect(result.qualityReport?.passed).toBe(true);
      expect(result.pdf?.subarray(0, 4).toString()).toBe("%PDF");
      expect(events).toContain("Complete");
      if (process.env.LIVE_BOOKLET_OUTPUT_DIR) {
        const directory = path.resolve(process.env.LIVE_BOOKLET_OUTPUT_DIR);
        await fs.mkdir(directory, { recursive: true });
        await fs.writeFile(
          path.join(directory, "northstar-fabrication-2026-benefits-guide.pdf"),
          result.pdf!,
        );
        await fs.writeFile(
          path.join(directory, "northstar-fabrication-2026-confidence.json"),
          `${JSON.stringify(result.benefitsPackage.confidenceReport, null, 2)}\n`,
        );
      }
    },
    900_000,
  );
});
