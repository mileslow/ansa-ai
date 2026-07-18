import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { z } from "zod";
import type {
  BenefitType,
  ClassifiedDocument,
  ContributionMode,
  LoadedUploadedFile,
  SourceRef,
} from "./booklet-types";

const EvidenceTextSchema = z.object({
  value: z.string(),
  page: z.number().int().positive().nullable(),
  quote: z.string().nullable(),
  confidence: z.number().min(0).max(1),
});

const OptionalEvidenceTextSchema = EvidenceTextSchema.nullable();

export const BookletDocumentExtractionSchema = z.object({
  employer: z.object({
    name: OptionalEvidenceTextSchema,
    legalName: OptionalEvidenceTextSchema,
    address: OptionalEvidenceTextSchema,
    website: OptionalEvidenceTextSchema,
  }),
  planYear: z.object({
    start: OptionalEvidenceTextSchema,
    end: OptionalEvidenceTextSchema,
    label: OptionalEvidenceTextSchema,
  }),
  eligibility: z.object({
    waitingPeriod: OptionalEvidenceTextSchema,
    description: OptionalEvidenceTextSchema,
    employeeClasses: z.array(EvidenceTextSchema),
  }),
  offeredBenefits: z.array(
    z.object({
      benefitType: z.enum([
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
      offered: z.boolean(),
      page: z.number().int().positive().nullable(),
      quote: z.string().nullable(),
      confidence: z.number().min(0).max(1),
    }),
  ),
  selectedPlans: z.array(
    z.object({
      planName: z.string(),
      benefitType: z.enum(["medical", "dental", "vision", "life", "std", "ltd"]),
      carrier: z.string().nullable(),
      page: z.number().int().positive().nullable(),
      quote: z.string().nullable(),
      confidence: z.number().min(0).max(1),
    }),
  ),
  contributions: z.array(
    z.object({
      benefitType: z.enum([
        "medical",
        "dental",
        "vision",
        "life",
        "std",
        "ltd",
        "hsa",
        "hra",
        "fsa",
      ]),
      planName: z.string().nullable(),
      tier: z.string(),
      employeeClass: z.string().nullable(),
      mode: z.enum(["percent", "flat_monthly", "flat_per_pay"]),
      value: z.number(),
      payPeriods: z.number().int().positive().nullable(),
      page: z.number().int().positive().nullable(),
      quote: z.string().nullable(),
      confidence: z.number().min(0).max(1),
    }),
  ),
  contacts: z.array(
    z.object({
      role: z.string(),
      name: z.string().nullable(),
      organization: z.string().nullable(),
      phone: z.string().nullable(),
      email: z.string().nullable(),
      website: z.string().nullable(),
      page: z.number().int().positive().nullable(),
      confidence: z.number().min(0).max(1),
    }),
  ),
  accounts: z.array(
    z.object({
      type: z.enum(["hsa", "hra", "fsa"]),
      administrator: z.string().nullable(),
      page: z.number().int().positive().nullable(),
      confidence: z.number().min(0).max(1),
    }),
  ),
  sectionOrder: z.array(z.string()),
  templateRole: z.enum(["employer_factual", "employer_prior_context", "master_template", "none"]),
  extractionMethod: z.enum(["pdf_text", "ocr", "model", "email_text"]),
  warnings: z.array(z.string()),
});

export type BookletDocumentExtraction = z.infer<typeof BookletDocumentExtractionSchema> & {
  fileId: string;
  fileName: string;
  documentType: ClassifiedDocument["documentType"];
};

const SYSTEM_PROMPT = `You extract source-backed facts for an employee benefits booklet.
Use only the supplied document. Never infer checked boxes, filled values, employer identity,
contributions, benefit offerings, or selected plans from blank form labels. A blank application
is a template, not factual evidence. Keep current employer facts separate from master-template
or prior-employer facts. Return concise quotes and exact source page numbers. If the PDF is
image-only, visually read it and set extractionMethod to ocr. Record uncertainty in warnings.`;

function promptFor(classification: ClassifiedDocument) {
  const role = {
    employer_application:
      "Extract filled employer setup, eligibility, selected products, contribution rules, accounts, and contacts. Ignore empty form fields and unchecked options.",
    prior_booklet:
      "Extract employer-specific prior context, offered sections, eligibility language, plan names, contacts, and section order. Treat year-specific facts as prior unless clearly current.",
    benefit_guide:
      "Determine whether this is an employer-specific current guide or a master template. Extract section order and style role. Do not copy one employer's facts to another.",
    email_export:
      "Extract explicit employer instructions, plan selections, contribution decisions, dates, eligibility, and contacts from the email body and quoted thread.",
    plan_summary:
      "Extract plan identity, carrier, plan year, benefit type, and any explicit employer setup or contribution facts.",
  }[classification.documentType];
  return `${role || "Extract booklet-relevant employer and benefit facts."}\nClassified document type: ${classification.documentType}.`;
}

function fileContent(file: LoadedUploadedFile) {
  if (file.textContent)
    return [
      {
        type: "input_text" as const,
        text: `BEGIN SOURCE DOCUMENT: ${file.fileName}\n${file.textContent}\nEND SOURCE DOCUMENT: ${file.fileName}`,
      },
    ];
  return [
    {
      type: "input_file" as const,
      filename: file.fileName,
      file_data: `data:${file.mimeType || "application/pdf"};base64,${file.data.toString("base64")}`,
    },
  ];
}

export async function extractBookletDocument({
  file,
  classification,
  apiKey = process.env.OPENAI_API_KEY,
  client = new OpenAI({ apiKey }),
  model = process.env.OPENAI_BOOKLET_MODEL || "gpt-5.4-mini",
}: {
  file: LoadedUploadedFile;
  classification: ClassifiedDocument;
  apiKey?: string;
  client?: Pick<OpenAI, "responses">;
  model?: string;
}): Promise<BookletDocumentExtraction> {
  if (!file.data.length && !file.textContent) throw new Error(`${file.fileName} is empty`);
  const response = await client.responses.parse({
    model,
    reasoning: { effort: "low" },
    input: [
      { role: "system", content: SYSTEM_PROMPT },
      {
        role: "user",
        content: [
          ...fileContent(file),
          { type: "input_text", text: promptFor(classification) },
        ],
      },
    ],
    text: {
      format: zodTextFormat(BookletDocumentExtractionSchema, "booklet_document_extraction"),
    },
  });
  if (!response.output_parsed)
    throw new Error(`OpenAI returned no parsed extraction for ${file.fileName}`);
  return {
    ...response.output_parsed,
    fileId: file.id,
    fileName: file.fileName,
    documentType: classification.documentType,
  };
}

export function extractionSource(
  extraction: BookletDocumentExtraction,
  page: number | null,
  quote?: string | null,
): SourceRef {
  return {
    fileId: extraction.fileId,
    fileName: extraction.fileName,
    documentType: extraction.documentType,
    page: page || undefined,
    textRange: quote || undefined,
    extractionMethod:
      extraction.extractionMethod === "email_text"
        ? "model"
        : extraction.extractionMethod,
  };
}

export function normalizeContributionMode(value: string): ContributionMode {
  if (value === "flat_per_pay") return "flat_per_pay";
  if (value === "flat_monthly") return "flat_monthly";
  return "percent";
}

export function normalizeBenefitType(value: string): BenefitType {
  return value.toLowerCase() as BenefitType;
}
