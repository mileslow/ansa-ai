import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { extractBookletDocument } from "../lib/booklet-document-extractor";
import { runBookletPipeline } from "../lib/booklet-pipeline";
import type { LoadedUploadedFile } from "../lib/booklet-types";
import { classifyDocumentWithFallback } from "../lib/document-classifier";

const live =
  process.env.RUN_LIVE_BOOKLET_HSA_STD_TESTS === "1" &&
  Boolean(process.env.OPENAI_API_KEY);

async function loaded(relativePath: string): Promise<LoadedUploadedFile> {
  const data = await fs.readFile(path.resolve(relativePath));
  return {
    id: createHash("sha1").update(relativePath).digest("hex").slice(0, 16),
    companyId: "real-hsa-std-live",
    fileName: path.basename(relativePath),
    storagePath: relativePath,
    mimeType: "application/pdf",
    uploadedAt: new Date().toISOString(),
    sha256: createHash("sha256").update(data).digest("hex"),
    processingStatus: "uploaded",
    data,
  };
}

const answers = {
  "planYear.start": "2026-01-01",
  "planYear.end": "2026-12-31",
  "planYear.label": "2026",
  "eligibility.waitingPeriod": "Eligibility is governed by the source plan materials",
};

describe.skipIf(!live)("live HSA and STD real-document pipeline", () => {
  it(
    "extracts a real Minnesota HSA form but blocks until employer program facts are supplied",
    async () => {
      const file = await loaded(
        "source-docs/03_benefit-source-documents/hsa/minnesota-segip-hsa/2026-contribution-change-form.pdf",
      );
      const result = await runBookletPipeline({
        runId: "live-real-hsa",
        companyId: "minnesota-segip-hsa",
        files: [file],
        answers,
        dependencies: {
          classify: (input) => classifyDocumentWithFallback({ file: input }),
          extractDocument: async (input) => {
            const extracted = await extractBookletDocument(input);
            // This scenario explicitly treats the current SEGIP form as the
            // employer's HSA source even though its employee election fields
            // are blank. Blank personal fields must not become employee facts.
            return {
              ...extracted,
              templateRole: "employer_factual",
            };
          },
        },
      });

      expect(result.status).toBe("blocked");
      expect(result.classifications[0].benefitTypes).toContain("hsa");
      expect(
        result.benefitsPackage.requirements?.subjects.some(
          (subject) => subject.benefitType === "hsa",
        ),
      ).toBe(true);
      expect(result.questions).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            benefitType: "hsa",
          }),
        ]),
      );
      expect(result).not.toHaveProperty("pdf");
      expect(result).not.toHaveProperty("html");
    },
    600_000,
  );

  it(
    "understands a real University of California STD summary but blocks incomplete contract fields",
    async () => {
      const file = await loaded(
        "source-docs/03_benefit-source-documents/short-term-disability/university-of-california-basic-disability/lincoln-summary.pdf",
      );
      const result = await runBookletPipeline({
        runId: "live-real-std",
        companyId: "university-california-std",
        files: [file],
        answers: { ...answers, "employer.name": "University of California" },
        dependencies: {
          extractDocument: async (input) => {
            const extracted = await extractBookletDocument(input);
            return { ...extracted, templateRole: "employer_factual" };
          },
        },
      });

      expect(result.status).toBe("blocked");
      expect(result.classifications[0].benefitTypes).toContain("std");
      expect(result.benefitsPackage.requirements?.subjects).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            benefitType: "std",
            displayName: "Basic Short-Term Disability Insurance",
          }),
        ]),
      );
      expect(result.questions).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            benefitType: "std",
            blockerCode: "STD_DEFINITION_MISSING",
          }),
        ]),
      );
      expect(result).not.toHaveProperty("pdf");
      expect(result).not.toHaveProperty("html");
    },
    600_000,
  );
});
