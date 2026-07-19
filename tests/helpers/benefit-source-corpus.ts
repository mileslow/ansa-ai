import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import type { BenefitType } from "../../lib/booklet-types";

const execFileAsync = promisify(execFile);

export const BENEFIT_SOURCE_ROOT = path.resolve(
  "source-docs/03_benefit-source-documents",
);

export const BENEFIT_SOURCE_CATEGORIES = [
  "combined-disability",
  "dental",
  "eap",
  "fsa",
  "hra",
  "hsa",
  "life-and-add",
  "long-term-disability",
  "medical-insurance",
  "package-wide-plan-documents",
  "prescription-and-pharmacy",
  "short-term-disability",
  "telemedicine",
  "vision",
  "voluntary-and-aflac",
] as const;

export type BenefitSourceCategory =
  (typeof BENEFIT_SOURCE_CATEGORIES)[number];

type ExpectedMatch = "all" | "any";

const CATEGORY_EXPECTATIONS: Record<
  BenefitSourceCategory,
  { benefitTypes: BenefitType[]; expectedMatch: ExpectedMatch }
> = {
  "combined-disability": { benefitTypes: ["std", "ltd"], expectedMatch: "all" },
  dental: { benefitTypes: ["dental"], expectedMatch: "all" },
  eap: { benefitTypes: ["eap"], expectedMatch: "all" },
  fsa: { benefitTypes: ["fsa"], expectedMatch: "all" },
  hra: { benefitTypes: ["hra"], expectedMatch: "all" },
  hsa: { benefitTypes: ["hsa"], expectedMatch: "all" },
  "life-and-add": { benefitTypes: ["life"], expectedMatch: "all" },
  "long-term-disability": { benefitTypes: ["ltd"], expectedMatch: "all" },
  "medical-insurance": { benefitTypes: ["medical"], expectedMatch: "all" },
  "package-wide-plan-documents": {
    benefitTypes: [
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
    ],
    expectedMatch: "any",
  },
  "prescription-and-pharmacy": {
    benefitTypes: ["medical"],
    expectedMatch: "all",
  },
  "short-term-disability": { benefitTypes: ["std"], expectedMatch: "all" },
  telemedicine: { benefitTypes: ["telemedicine"], expectedMatch: "all" },
  vision: { benefitTypes: ["vision"], expectedMatch: "all" },
  "voluntary-and-aflac": {
    benefitTypes: ["voluntary"],
    expectedMatch: "all",
  },
};

export type BenefitSourceDocument = {
  absolutePath: string;
  relativePath: string;
  category: BenefitSourceCategory;
  offering: string;
  optionOrDocument: string;
  expectedBenefitTypes: BenefitType[];
  expectedMatch: ExpectedMatch;
};

async function pdfPaths(directory: string): Promise<string[]> {
  const entries = await fs.readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map(async (entry) => {
      const absolutePath = path.join(directory, entry.name);
      if (entry.isDirectory()) return pdfPaths(absolutePath);
      return entry.isFile() && entry.name.toLowerCase().endsWith(".pdf")
        ? [absolutePath]
        : [];
    }),
  );
  return nested.flat();
}

export async function discoverBenefitSourceDocuments(
  root = BENEFIT_SOURCE_ROOT,
): Promise<BenefitSourceDocument[]> {
  const documents = await pdfPaths(root);
  return documents
    .map((absolutePath) => {
      const relativePath = path.relative(root, absolutePath).split(path.sep).join("/");
      const [rawCategory, offering, ...optionParts] = relativePath.split("/");
      if (!BENEFIT_SOURCE_CATEGORIES.includes(rawCategory as BenefitSourceCategory))
        throw new Error(`Unknown benefit source category: ${rawCategory}`);
      if (!offering || optionParts.length === 0)
        throw new Error(
          `Benefit source path must contain category/offering/document.pdf: ${relativePath}`,
        );
      const category = rawCategory as BenefitSourceCategory;
      const expectation = CATEGORY_EXPECTATIONS[category];
      return {
        absolutePath,
        relativePath,
        category,
        offering,
        optionOrDocument: optionParts.join("/"),
        expectedBenefitTypes: [...expectation.benefitTypes],
        expectedMatch: expectation.expectedMatch,
      };
    })
    .sort((left, right) => left.relativePath.localeCompare(right.relativePath));
}

function seededRank(seed: string, discriminator: string) {
  return createHash("sha256")
    .update(`${seed}\0${discriminator}`)
    .digest("hex");
}

function ranked(
  documents: BenefitSourceDocument[],
  seed: string,
  discriminator: string,
) {
  return [...documents].sort((left, right) =>
    seededRank(seed, `${discriminator}\0${left.relativePath}`).localeCompare(
      seededRank(seed, `${discriminator}\0${right.relativePath}`),
    ),
  );
}

export function sampleBenefitSourceDocuments(
  documents: BenefitSourceDocument[],
  options: {
    seed: string;
    categories?: BenefitSourceCategory[];
    size?: number;
  },
) {
  const categories = options.categories?.length
    ? [...new Set(options.categories)]
    : [...BENEFIT_SOURCE_CATEGORIES];
  const eligible = documents.filter((document) =>
    categories.includes(document.category),
  );
  const majorCategories: BenefitSourceCategory[] = [
    "medical-insurance",
    "dental",
    "vision",
  ].filter((category) => categories.includes(category)) as BenefitSourceCategory[];
  const defaultSize = Math.min(
    eligible.length,
    categories.length + majorCategories.length,
  );
  const targetSize = Math.max(
    0,
    Math.min(eligible.length, options.size ?? defaultSize),
  );
  const selected: BenefitSourceDocument[] = [];
  const selectedPaths = new Set<string>();
  const take = (document: BenefitSourceDocument | undefined) => {
    if (!document || selected.length >= targetSize) return;
    if (selectedPaths.has(document.relativePath)) return;
    selected.push(document);
    selectedPaths.add(document.relativePath);
  };

  for (const category of categories) {
    take(
      ranked(
        eligible.filter((document) => document.category === category),
        options.seed,
        `category:${category}:primary`,
      )[0],
    );
  }

  for (const category of majorCategories) {
    const categoryDocuments = ranked(
      eligible.filter((document) => document.category === category),
      options.seed,
      `category:${category}:secondary`,
    );
    take(
      categoryDocuments.find(
        (document) => !selectedPaths.has(document.relativePath),
      ),
    );
  }

  for (const document of ranked(eligible, options.seed, "global-fill"))
    take(document);

  return selected;
}

export type SampledPdf = {
  data: Buffer;
  originalPageNumbers: number[];
  totalOriginalPages: number;
};

export async function samplePdfPages(
  document: BenefitSourceDocument,
  options: { seed: string; maxPages?: number },
): Promise<SampledPdf> {
  // Poppler accepts several real-world PDFs whose malformed object references
  // make pdf-lib throw before it can inspect the page tree.
  const { stdout: pdfInfo } = await execFileAsync("pdfinfo", [
    document.absolutePath,
  ]);
  const totalOriginalPages = Number(
    pdfInfo.match(/^Pages:\s+(\d+)$/m)?.[1] || 0,
  );
  if (totalOriginalPages === 0)
    throw new Error(`Could not determine PDF pages: ${document.relativePath}`);
  const maxPages = Math.max(
    1,
    Math.min(totalOriginalPages, options.maxPages ?? 3),
  );
  const otherPages = Array.from(
    { length: Math.max(0, totalOriginalPages - 1) },
    (_, index) => index + 2,
  ).sort((left, right) =>
    seededRank(
      options.seed,
      `page:${document.relativePath}:${left}`,
    ).localeCompare(
      seededRank(options.seed, `page:${document.relativePath}:${right}`),
    ),
  );
  const originalPageNumbers = [1, ...otherPages.slice(0, maxPages - 1)].sort(
    (left, right) => left - right,
  );
  const temporaryDirectory = await fs.mkdtemp(
    path.join(os.tmpdir(), "ansa-benefit-source-pages-"),
  );
  try {
    const outputPath = path.join(temporaryDirectory, "sampled.pdf");
    // Rewrite selected pages into a clean PDF. pdfseparate/pdfunite keeps
    // encryption flags and cannot merge several readable certificates here.
    await execFileAsync("gs", [
      "-q",
      "-dSAFER",
      "-dBATCH",
      "-dNOPAUSE",
      "-sDEVICE=pdfwrite",
      `-sPageList=${originalPageNumbers.join(",")}`,
      `-sOutputFile=${outputPath}`,
      document.absolutePath,
    ]);
    return {
      data: await fs.readFile(outputPath),
      originalPageNumbers,
      totalOriginalPages,
    };
  } finally {
    await fs.rm(temporaryDirectory, { recursive: true, force: true });
  }
}

export function dailyBenefitSourceSeed(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

export function parseBenefitSourceCategories(value: string | undefined) {
  if (!value) return undefined;
  const categories = value
    .split(",")
    .map((category) => category.trim())
    .filter(Boolean);
  const invalid = categories.filter(
    (category) =>
      !BENEFIT_SOURCE_CATEGORIES.includes(category as BenefitSourceCategory),
  );
  if (invalid.length)
    throw new Error(`Unknown benefit source categories: ${invalid.join(", ")}`);
  return categories as BenefitSourceCategory[];
}
