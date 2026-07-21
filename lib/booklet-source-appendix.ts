import type { ClassifiedDocument, LoadedUploadedFile } from "./booklet-types";

/**
 * @deprecated Source documents are evidence for the generated employee
 * summary, not pages to reproduce in its output. This compatibility wrapper
 * intentionally returns only the generated summary PDF.
 */
export async function appendAuthoritativeSourceBooklet({
  generatedPdf,
}: {
  generatedPdf: Buffer;
  files: LoadedUploadedFile[];
  classifications: ClassifiedDocument[];
  enabled: boolean;
}) {
  return generatedPdf;
}
