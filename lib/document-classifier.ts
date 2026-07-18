import * as XLSX from "xlsx";
import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { z } from "zod";
import type {
  ClassifiedDocument,
  DocumentType,
  LoadedUploadedFile,
} from "./booklet-types";

const text = (value: unknown) => String(value ?? "").toLowerCase();

function spreadsheetSample(file: LoadedUploadedFile) {
  try {
    const workbook = XLSX.read(file.data, { type: "buffer", dense: true });
    return workbook.SheetNames.slice(0, 8)
      .flatMap((sheetName) => {
        const rows = XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets[sheetName], {
          header: 1,
          defval: "",
        });
        return [sheetName, ...rows.slice(0, 12).flat().map(String)];
      })
      .join(" ")
      .slice(0, 20_000);
  } catch {
    return "";
  }
}

function classifyFromSignals(file: LoadedUploadedFile) {
  const name = text(file.fileName);
  const mime = text(file.mimeType);
  const sample = text(
    file.textContent ||
      (mime.includes("spreadsheet") || mime.includes("csv") || /\.(?:xlsx?|csv)$/.test(name)
        ? spreadsheetSample(file)
        : ""),
  );
  const combined = `${name} ${sample}`;

  const result = (
    documentType: DocumentType,
    confidence: number,
    reasoningSummary: string,
  ) => ({ documentType, confidence, reasoningSummary });

  if (
    /employer|group application|new group application/.test(combined) &&
    /application|enrollment form/.test(combined)
  )
    return result(
      "employer_application",
      name.includes("application") ? 0.97 : 0.9,
      "Employer/group application signals found in the filename or document text.",
    );

  if (
    /\.(?:xlsx?|csv)$/.test(name) ||
    mime.includes("spreadsheet") ||
    mime.includes("excel") ||
    mime.includes("csv")
  ) {
    if (/renewal|current vs|\b20\d{2}\s+vs\s+20\d{2}\b/.test(combined))
      return result(
        "renewal_spreadsheet",
        0.94,
        "Workbook contains renewal or year-over-year contribution/cost signals.",
      );
    if (/plan name|single rate|subscriber and spouse|monthly premium|rate sheet/.test(combined))
      return result(
        "carrier_rate_sheet",
        0.93,
        "Workbook contains carrier plan and tier-rate headers.",
      );
    if (/census|employee name|date of birth|dob/.test(combined))
      return result("census", 0.9, "Workbook contains employee census headers.");
    return result("unknown", 0.55, "Spreadsheet format recognized, but its role is unclear.");
  }

  if (/summary of benefits and coverage|\bsbc\b/.test(combined))
    return result("sbc", 0.96, "Summary of Benefits and Coverage signals found.");
  if (/summary plan description|\bspd\b/.test(combined))
    return result("spd", 0.95, "Summary Plan Description signals found.");
  if (/benefit plan summary|plan summary|benefit summary/.test(combined))
    return result("plan_summary", 0.88, "Plan-summary signals found.");
  if (/prior|last year|previous/.test(name) && /booklet|guide/.test(name))
    return result("prior_booklet", 0.9, "Filename identifies a prior booklet or guide.");
  if (/booklet/.test(name) || /employee benefits guide/.test(combined))
    return result("prior_booklet", 0.83, "Employee booklet signals found.");
  if (/benefit guide|benefits guide/.test(combined))
    return result("benefit_guide", 0.86, "Benefit-guide signals found.");
  if (/\.(?:eml|msg)$/.test(name) || /email export/.test(combined))
    return result("email_export", 0.95, "Email export extension or marker found.");
  return result("unknown", 0.35, "No high-confidence document-type signals found.");
}

export function classifyDocument(file: LoadedUploadedFile): ClassifiedDocument {
  const classification = classifyFromSignals(file);
  const sample = file.textContent || "";
  const employer = sample.match(
    /(?:group\/business name|legal entity name|prepared for|employer)\s*[:\-]\s*([^\n]{2,100})/i,
  )?.[1];
  const carrier = `${file.fileName} ${sample}`.match(
    /\b(Excellus|UnitedHealthcare|United Health(?:care)?|UHC|Cigna|Aetna|MVP|Oxford)\b/i,
  )?.[1];
  const year = `${file.fileName} ${sample}`.match(/\b(20\d{2})\b/)?.[1];
  return {
    fileId: file.id,
    ...classification,
    detectedEmployer: employer?.trim() || null,
    detectedCarrier: carrier || null,
    detectedPlanYear: year || null,
  };
}

export function classifyDocuments(files: LoadedUploadedFile[]) {
  return files.map(classifyDocument);
}

const ModelClassificationSchema = z.object({
  documentType: z.enum([
    "employer_application",
    "carrier_rate_sheet",
    "plan_summary",
    "sbc",
    "spd",
    "benefit_guide",
    "prior_booklet",
    "census",
    "renewal_spreadsheet",
    "email_export",
    "unknown",
  ]),
  confidence: z.number().min(0).max(1),
  detectedEmployer: z.string().nullable(),
  detectedCarrier: z.string().nullable(),
  detectedPlanYear: z.string().nullable(),
  reasoningSummary: z.string(),
});

export async function classifyDocumentWithFallback({
  file,
  apiKey = process.env.OPENAI_API_KEY,
  client = new OpenAI({ apiKey }),
  model = process.env.OPENAI_BOOKLET_MODEL || "gpt-5.4-mini",
}: {
  file: LoadedUploadedFile;
  apiKey?: string;
  client?: Pick<OpenAI, "responses">;
  model?: string;
}): Promise<ClassifiedDocument> {
  const heuristic = classifyDocument(file);
  if (heuristic.confidence >= 0.8 || !apiKey) return heuristic;
  const content = file.textContent
    ? [{ type: "input_text" as const, text: file.textContent.slice(0, 30_000) }]
    : [
        {
          type: "input_file" as const,
          filename: file.fileName,
          file_data: `data:${file.mimeType || "application/octet-stream"};base64,${file.data.toString("base64")}`,
        },
      ];
  const response = await client.responses.parse({
    model,
    reasoning: { effort: "low" },
    input: [
      {
        role: "system",
        content:
          "Classify this employee-benefits source document. A blank form is still an employer_application. Distinguish a plan SBC/SPD from an employee benefit guide and a prior employer booklet. Use only visible evidence.",
      },
      {
        role: "user",
        content: [
          ...content,
          { type: "input_text", text: `Filename: ${file.fileName}` },
        ],
      },
    ],
    text: { format: zodTextFormat(ModelClassificationSchema, "document_classification") },
  });
  if (!response.output_parsed) return heuristic;
  return { fileId: file.id, ...response.output_parsed };
}
