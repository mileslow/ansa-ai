import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { PDFDocument } from "pdf-lib";

const execFileAsync = promisify(execFile);

export type PdfPageChunk = {
  data: Buffer;
  startPage: number;
  endPage: number;
  totalPages: number | null;
  method: "original" | "pdf-lib" | "ghostscript";
  warning?: string;
};

function pageWindows(totalPages: number, maxPages: number, overlapPages: number) {
  if (totalPages <= maxPages) return [{ startPage: 1, endPage: totalPages }];
  const windows: Array<{ startPage: number; endPage: number }> = [];
  const step = Math.max(1, maxPages - overlapPages);
  for (let startPage = 1; startPage <= totalPages; startPage += step) {
    const endPage = Math.min(totalPages, startPage + maxPages - 1);
    windows.push({ startPage, endPage });
    if (endPage === totalPages) break;
  }
  return windows;
}

async function chunksWithPdfLib(
  data: Buffer,
  maxPages: number,
  overlapPages: number,
): Promise<PdfPageChunk[]> {
  const source = await PDFDocument.load(data, {
    ignoreEncryption: true,
    throwOnInvalidObject: false,
    updateMetadata: false,
  });
  const totalPages = source.getPageCount();
  if (totalPages <= maxPages)
    return [
      {
        data,
        startPage: 1,
        endPage: totalPages,
        totalPages,
        method: "original",
      },
    ];
  const chunks: PdfPageChunk[] = [];
  for (const window of pageWindows(totalPages, maxPages, overlapPages)) {
    const target = await PDFDocument.create();
    const indexes = Array.from(
      { length: window.endPage - window.startPage + 1 },
      (_, index) => window.startPage - 1 + index,
    );
    const pages = await target.copyPages(source, indexes);
    for (const page of pages) target.addPage(page);
    chunks.push({
      data: Buffer.from(await target.save({ useObjectStreams: false })),
      ...window,
      totalPages,
      method: "pdf-lib",
    });
  }
  return chunks;
}

function postscriptString(value: string) {
  return value.replace(/([\\()])/g, "\\$1");
}

async function ghostscriptPageCount(inputPath: string) {
  const { stdout } = await execFileAsync(
    "gs",
    [
      "-q",
      "-dNODISPLAY",
      "-dNOSAFER",
      "-c",
      `(${postscriptString(inputPath)}) (r) file runpdfbegin pdfpagecount = quit`,
    ],
    { timeout: 30_000 },
  );
  const totalPages = Number.parseInt(stdout.trim(), 10);
  if (!Number.isInteger(totalPages) || totalPages <= 0)
    throw new Error("Ghostscript did not return a valid PDF page count.");
  return totalPages;
}

async function chunksWithGhostscript(
  data: Buffer,
  maxPages: number,
  overlapPages: number,
): Promise<PdfPageChunk[]> {
  const temporaryDirectory = await fs.mkdtemp(
    path.join(os.tmpdir(), "ansa-booklet-pdf-"),
  );
  try {
    const inputPath = path.join(temporaryDirectory, "input.pdf");
    await fs.writeFile(inputPath, data);
    const totalPages = await ghostscriptPageCount(inputPath);
    if (totalPages <= maxPages)
      return [
        {
          data,
          startPage: 1,
          endPage: totalPages,
          totalPages,
          method: "original",
        },
      ];
    const chunks: PdfPageChunk[] = [];
    for (const [index, window] of pageWindows(
      totalPages,
      maxPages,
      overlapPages,
    ).entries()) {
      const outputPath = path.join(temporaryDirectory, `chunk-${index}.pdf`);
      await execFileAsync(
        "gs",
        [
          "-q",
          "-dSAFER",
          "-dBATCH",
          "-dNOPAUSE",
          "-sDEVICE=pdfwrite",
          `-dFirstPage=${window.startPage}`,
          `-dLastPage=${window.endPage}`,
          `-sOutputFile=${outputPath}`,
          inputPath,
        ],
        { timeout: 120_000 },
      );
      chunks.push({
        data: await fs.readFile(outputPath),
        ...window,
        totalPages,
        method: "ghostscript",
      });
    }
    return chunks;
  } finally {
    await fs.rm(temporaryDirectory, { recursive: true, force: true });
  }
}

/**
 * Splits long PDFs into bounded, overlapping page windows so model extraction
 * cannot silently lose later sections to context or output limits. Malformed
 * real-world PDFs are normalized through Ghostscript when pdf-lib cannot read
 * their page trees. If both mechanisms fail, callers still receive the full
 * source and a warning instead of losing the document entirely.
 */
export async function createPdfPageChunks(
  data: Buffer,
  options: { maxPages?: number; overlapPages?: number } = {},
): Promise<PdfPageChunk[]> {
  const maxPages = Math.max(2, options.maxPages ?? 24);
  const overlapPages = Math.max(
    0,
    Math.min(maxPages - 1, options.overlapPages ?? 1),
  );
  try {
    return await chunksWithPdfLib(data, maxPages, overlapPages);
  } catch (pdfLibError) {
    try {
      return await chunksWithGhostscript(data, maxPages, overlapPages);
    } catch (ghostscriptError) {
      return [
        {
          data,
          startPage: 1,
          endPage: 1,
          totalPages: null,
          method: "original",
          warning: `Could not page-chunk PDF (${pdfLibError instanceof Error ? pdfLibError.message : String(pdfLibError)}; ${ghostscriptError instanceof Error ? ghostscriptError.message : String(ghostscriptError)}). Exhaustive extraction used the full source in one pass.`,
        },
      ];
    }
  }
}
