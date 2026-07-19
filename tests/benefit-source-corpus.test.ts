import { PDFDocument } from "pdf-lib";
import { describe, expect, it } from "vitest";
import {
  BENEFIT_SOURCE_CATEGORIES,
  discoverBenefitSourceDocuments,
  sampleBenefitSourceDocuments,
  samplePdfPages,
} from "./helpers/benefit-source-corpus";

const expectedCounts = {
  "combined-disability": 1,
  dental: 8,
  eap: 5,
  fsa: 5,
  hra: 5,
  hsa: 5,
  "life-and-add": 6,
  "long-term-disability": 6,
  "medical-insurance": 25,
  "package-wide-plan-documents": 1,
  "prescription-and-pharmacy": 3,
  "short-term-disability": 6,
  telemedicine: 5,
  vision: 8,
  "voluntary-and-aflac": 5,
};

describe("benefit source corpus sampling", () => {
  it("indexes all 94 PDFs and represents all 12 canonical benefit types", async () => {
    const documents = await discoverBenefitSourceDocuments();
    const counts = Object.fromEntries(
      BENEFIT_SOURCE_CATEGORIES.map((category) => [
        category,
        documents.filter((document) => document.category === category).length,
      ]),
    );
    expect(documents).toHaveLength(94);
    expect(counts).toEqual(expectedCounts);
    expect(
      new Set(documents.flatMap((document) => document.expectedBenefitTypes)),
    ).toEqual(
      new Set([
        "medical",
        "dental",
        "vision",
        "life",
        "std",
        "ltd",
        "eap",
        "voluntary",
        "telemedicine",
        "hsa",
        "hra",
        "fsa",
      ]),
    );
    expect(documents.every((document) => document.offering.length > 0)).toBe(true);
    expect(
      documents.every((document) => document.optionOrDocument.endsWith(".pdf")),
    ).toBe(true);
  });

  it("is reproducible and stratifies the default sample across the corpus", async () => {
    const documents = await discoverBenefitSourceDocuments();
    const first = sampleBenefitSourceDocuments(documents, {
      seed: "contract-seed-a",
    });
    const repeated = sampleBenefitSourceDocuments(documents, {
      seed: "contract-seed-a",
    });
    const different = sampleBenefitSourceDocuments(documents, {
      seed: "contract-seed-b",
    });
    expect(first.map((document) => document.relativePath)).toEqual(
      repeated.map((document) => document.relativePath),
    );
    expect(first.map((document) => document.relativePath)).not.toEqual(
      different.map((document) => document.relativePath),
    );
    expect(first).toHaveLength(18);
    expect(new Set(first.map((document) => document.category))).toEqual(
      new Set(BENEFIT_SOURCE_CATEGORIES),
    );
    for (const category of ["medical-insurance", "dental", "vision"])
      expect(first.filter((document) => document.category === category)).toHaveLength(2);
  });

  it("can reach every PDF over a deterministic sequence of randomized seeds", async () => {
    const documents = await discoverBenefitSourceDocuments();
    const reached = new Set<string>();
    for (let index = 0; index < 2_048; index += 1) {
      for (const document of sampleBenefitSourceDocuments(documents, {
        seed: `coverage-seed-${index}`,
      }))
        reached.add(document.relativePath);
    }
    expect(reached).toEqual(
      new Set(documents.map((document) => document.relativePath)),
    );
  });

  it("always includes page one and reproducibly samples additional original pages", async () => {
    const documents = await discoverBenefitSourceDocuments();
    const document = documents.find(
      (candidate) =>
        candidate.relativePath ===
        "medical-insurance/kaiser-permanente-ca-small-group-2025-hmo/bronze-60-hdhp-hmo-6650-0-pcp.pdf",
    );
    expect(document).toBeDefined();
    const sampled = await samplePdfPages(document!, {
      seed: "page-contract-seed",
      maxPages: 3,
    });
    const repeated = await samplePdfPages(document!, {
      seed: "page-contract-seed",
      maxPages: 3,
    });
    const parsedSample = await PDFDocument.load(sampled.data);
    expect(sampled.originalPageNumbers[0]).toBe(1);
    expect(new Set(sampled.originalPageNumbers).size).toBe(
      sampled.originalPageNumbers.length,
    );
    expect(sampled.originalPageNumbers).toEqual(repeated.originalPageNumbers);
    expect(parsedSample.getPageCount()).toBe(sampled.originalPageNumbers.length);
    expect(sampled.originalPageNumbers.length).toBeLessThanOrEqual(3);
    expect(sampled.totalOriginalPages).toBeGreaterThanOrEqual(
      sampled.originalPageNumbers.length,
    );

    const encryptedCertificate = documents.find(
      (candidate) =>
        candidate.relativePath ===
        "combined-disability/duke-health-system-voluntary-std-ltd/combined-certificate-2017.pdf",
    );
    expect(encryptedCertificate).toBeDefined();
    const encryptedSample = await samplePdfPages(encryptedCertificate!, {
      seed: "encrypted-page-contract-seed",
      maxPages: 2,
    });
    expect((await PDFDocument.load(encryptedSample.data)).getPageCount()).toBe(2);
  });
});
