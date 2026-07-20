import { execFile } from "node:child_process";
import { mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { PDFDocument } from "pdf-lib";

const execFileAsync = promisify(execFile);
// AgentMail attachments are base64 encoded inside a JSON request. Keeping the
// binary under 3 MiB leaves room for the 4/3 base64 expansion and envelope.
const DEFAULT_TARGET_BYTES = 3 * 1024 * 1024;
const rasterProfiles = [
  { dpi: 120, quality: 82 },
  { dpi: 108, quality: 76 },
  { dpi: 96, quality: 70 },
];

async function rasterizePdf({
  input,
  source,
  directory,
  dpi,
  quality,
}: {
  input: string;
  source: PDFDocument;
  directory: string;
  dpi: number;
  quality: number;
}) {
  const outputPattern = join(directory, `page-${dpi}-%04d.jpg`);
  await execFileAsync(
    "gs",
    [
      "-sDEVICE=jpeg",
      `-r${dpi}`,
      `-dJPEGQ=${quality}`,
      "-dTextAlphaBits=4",
      "-dGraphicsAlphaBits=4",
      "-dNOPAUSE",
      "-dQUIET",
      "-dBATCH",
      `-sOutputFile=${outputPattern}`,
      input,
    ],
    { timeout: 180_000, maxBuffer: 2 * 1024 * 1024 },
  );
  const names = (await readdir(directory))
    .filter((name) => name.startsWith(`page-${dpi}-`) && name.endsWith(".jpg"))
    .sort();
  const sourcePages = source.getPages();
  if (names.length !== sourcePages.length) {
    throw new Error(
      `Ghostscript rendered ${names.length} pages from a ${sourcePages.length}-page PDF`,
    );
  }

  const output = await PDFDocument.create();
  for (const [index, name] of names.entries()) {
    const image = await output.embedJpg(await readFile(join(directory, name)));
    const { width, height } = sourcePages[index].getSize();
    const page = output.addPage([width, height]);
    page.drawImage(image, { x: 0, y: 0, width, height });
  }
  return Buffer.from(await output.save({ useObjectStreams: true }));
}

/**
 * Makes a large, image-heavy source booklet safe to include in AgentMail's JSON
 * send request. Only the source appendix is rasterized; the generated summary
 * remains text-based and searchable.
 */
export async function optimizePdfForEmailAppendix(
  pdf: Buffer,
  targetBytes = DEFAULT_TARGET_BYTES,
) {
  if (pdf.byteLength <= targetBytes) return pdf;

  const directory = await mkdtemp(join(tmpdir(), "ansa-email-pdf-"));
  try {
    const input = join(directory, "source.pdf");
    await writeFile(input, pdf);
    const source = await PDFDocument.load(pdf);
    let smallest = pdf;
    for (const profile of rasterProfiles) {
      const candidate = await rasterizePdf({
        input,
        source,
        directory,
        ...profile,
      });
      if (candidate.byteLength < smallest.byteLength) smallest = candidate;
      if (candidate.byteLength <= targetBytes) return candidate;
    }
    return smallest;
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}
