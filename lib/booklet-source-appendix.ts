import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import type { ClassifiedDocument, LoadedUploadedFile } from "./booklet-types";
import { optimizePdfForEmailAppendix } from "./pdf-email-optimizer";

const authoritativeBookletName = /(?:benefits?.*(?:booklet|guide)|(?:booklet|guide).*benefits?)/i;

export async function appendAuthoritativeSourceBooklet({
  generatedPdf,
  files,
  classifications,
  enabled,
}: {
  generatedPdf: Buffer;
  files: LoadedUploadedFile[];
  classifications: ClassifiedDocument[];
  enabled: boolean;
}) {
  if (!enabled) return generatedPdf;
  const nonEmail = classifications.filter(
    (classification) => classification.documentType !== "email_export",
  );
  if (nonEmail.length !== 1 || nonEmail[0].documentType !== "benefit_guide")
    return generatedPdf;
  const source = files.find((file) => file.id === nonEmail[0].fileId);
  if (
    !source ||
    source.mimeType !== "application/pdf" ||
    !authoritativeBookletName.test(source.fileName)
  ) return generatedPdf;

  const output = await PDFDocument.load(generatedPdf);
  const authoritative = await PDFDocument.load(
    await optimizePdfForEmailAppendix(source.data),
  );
  if (authoritative.getPageCount() < 2) return generatedPdf;

  const divider = output.addPage([612, 792]);
  const heading = await output.embedFont(StandardFonts.HelveticaBold);
  const body = await output.embedFont(StandardFonts.Helvetica);
  divider.drawRectangle({ x: 0, y: 0, width: 612, height: 792, color: rgb(0.96, 0.97, 0.98) });
  divider.drawRectangle({ x: 42, y: 0, width: 7, height: 792, color: rgb(0.11, 0.43, 0.6) });
  divider.drawText("AUTHORITATIVE SOURCE BOOKLET", {
    x: 78,
    y: 620,
    size: 22,
    font: heading,
    color: rgb(0.11, 0.43, 0.6),
  });
  divider.drawText("The following pages preserve the complete source booklet", {
    x: 78,
    y: 568,
    size: 13,
    font: body,
    color: rgb(0.16, 0.19, 0.22),
  });
  divider.drawText("for plan design, benefit details, limitations, and contacts.", {
    x: 78,
    y: 546,
    size: 13,
    font: body,
    color: rgb(0.16, 0.19, 0.22),
  });
  divider.drawText(`Source: ${source.fileName}`.slice(0, 76), {
    x: 78,
    y: 500,
    size: 10,
    font: body,
    color: rgb(0.35, 0.4, 0.44),
  });
  const pages = await output.copyPages(
    authoritative,
    authoritative.getPageIndices(),
  );
  for (const sourcePage of pages) output.addPage(sourcePage);
  output.setTitle("Source-backed employee benefits booklet");
  output.setSubject("Generated summary with authoritative source booklet appendix");
  return Buffer.from(await output.save());
}
