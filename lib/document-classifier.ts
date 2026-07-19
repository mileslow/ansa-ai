import * as XLSX from "xlsx";
import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { z } from "zod";
import type {
  BenefitType,
  ClassifiedDocument,
  DocumentScope,
  DocumentType,
  LoadedUploadedFile,
} from "./booklet-types";
import type { SourceAuthority } from "./benefit-requirements/types";

const text = (value: unknown) => String(value ?? "").toLowerCase();

const benefitSignals: Array<[BenefitType, RegExp]> = [
  ["dental", /\bdental\b|orthodont/],
  ["vision", /\bvision\b|eyewear|contact lenses/],
  ["std", /short[- ]term disability|\bstd\b/],
  ["ltd", /long[- ]term disability|\bltd\b/],
  ["life", /\blife\b|ad&d|accidental death/],
  ["eap", /employee assistance|\beap\b/],
  ["voluntary", /\bvoluntary\b|worksite|\bpbo\b|colonial|aflac/],
  ["telemedicine", /telemedicine|telehealth/],
  ["hsa", /health savings|\bhsa\b/],
  ["hra", /health reimbursement|\bhra\b/],
  ["fsa", /flexible spending|\bfsa\b/],
  ["medical", /\bmedical\b|health plan|health insurance|deductible|out-of-pocket/],
];

function detectedBenefitTypes(value: string) {
  return benefitSignals
    .filter(([, signal]) => signal.test(value))
    .map(([benefitType]) => benefitType);
}

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
  const normalizedCombined = combined.replace(/[^a-z0-9]+/g, " ");

  const result = (
    documentType: DocumentType,
    confidence: number,
    reasoningSummary: string,
  ) => ({ documentType, confidence, reasoningSummary });

  if (file.sourceKind === "company_website")
    return result(
      "company_website",
      1,
      "This source was captured directly from the supplied public company website.",
    );
  if (file.sourceKind === "thread_message")
    return result(
      "email_export",
      1,
      "This source is a user instruction saved directly on the booklet thread.",
    );

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
  if (/\b(?:formulary|performance drug list|prescription drug list)\b/.test(combined))
    return result(
      "plan_summary",
      0.9,
      "Prescription formulary or drug-list signals identify an administrative plan reference.",
    );
  if (/prior|last year|previous/.test(name) && /booklet|guide/.test(name))
    return result("prior_booklet", 0.9, "Filename identifies a prior booklet or guide.");
  if (/booklet/.test(name) || /employee benefits guide/.test(combined))
    return result("prior_booklet", 0.83, "Employee booklet signals found.");
  if (/benefit guide|benefits guide/.test(combined))
    return result("benefit_guide", 0.86, "Benefit-guide signals found.");
  if (/\.(?:eml|msg)$/.test(name) || /email export/.test(combined))
    return result("email_export", 0.95, "Email export extension or marker found.");
  if (/\b(?:std|disability|short term disability|ltd|long term disability)\b/.test(normalizedCombined))
    return result(
      "spd",
      0.92,
      "Disability plan signals identify an ancillary summary plan description.",
    );
  if (
    /\b(?:hsa|health savings account|hra|health reimbursement account|fsa|flexible spending account|dental|vision|life and ad d|telemedicine|employee assistance|eap|accident|critical illness|hospital indemnity)\b/.test(
      normalizedCombined,
    )
  )
    return result(
      "plan_summary",
      0.9,
      "Ancillary benefit signals identify a plan summary or administrative benefit document.",
    );
  return result("unknown", 0.35, "No high-confidence document-type signals found.");
}

function detectBenefitTypes(value: string, documentType: DocumentType): BenefitType[] {
  const normalized = value.toLowerCase().replace(/[^a-z0-9]+/g, " ");
  const detected = new Set<BenefitType>();
  const add = (type: BenefitType, pattern: RegExp) => {
    if (pattern.test(normalized)) detected.add(type);
  };
  add(
    "medical",
    /\b(?:medical|health plan|health coverage|sbc|formulary|performance drug list|prescription drug list|pharmacy benefit)\b/,
  );
  add("dental", /\b(?:dental|dhmo|orthodont)\w*\b/);
  add("vision", /\b(?:vision|eyewear|eye exam|contact lenses)\b/);
  add("life", /\b(?:life insurance|basic life|supplemental life|ad d|accidental death)\b/);
  add("std", /\b(?:std|short term disability|salary continuation)\b/);
  add("ltd", /\b(?:ltd|long term disability)\b/);
  add("eap", /\b(?:eap|employee assistance)\b/);
  add("telemedicine", /\b(?:telemedicine|telehealth|virtual care|virtual primary care)\b/);
  add("hsa", /\b(?:hsa|health savings account)\b/);
  add("hra", /\b(?:hra|health reimbursement arrangement|health reimbursement account|ichra|qsehra)\b/);
  add("fsa", /\b(?:fsa|flexible spending account|dependent care account)\b/);
  add("voluntary", /\b(?:accident insurance|critical illness|hospital indemnity|cancer insurance|voluntary benefit)\b/);

  // SBC pediatric rows describe medical-plan EHBs and must not activate a
  // standalone dental or vision subject.
  if (documentType === "sbc" && detected.has("medical")) {
    if (/\bpediatric dental\b/.test(normalized)) detected.delete("dental");
    if (/\bpediatric vision\b/.test(normalized)) detected.delete("vision");
  }
  return [...detected];
}

function documentContext(
  documentType: DocumentType,
  value: string,
  detectedEmployer: string | null,
): {
  scope: DocumentScope;
  authority: SourceAuthority;
  documentSubtype: string;
} {
  const normalized = value.toLowerCase();
  if (/\b(?:irs|cms|department of labor|dol|hhs|federal register|29 cfr)\b/.test(normalized))
    return { scope: "regulatory", authority: "regulatory_source", documentSubtype: "regulatory_guidance" };
  if (documentType === "prior_booklet")
    return { scope: "prior_employer", authority: "prior_year_context", documentSubtype: "prior_employer_guide" };
  if (documentType === "employer_application" || documentType === "email_export")
    return { scope: "current_employer", authority: "employer_selection", documentSubtype: documentType };
  if (documentType === "carrier_rate_sheet" || documentType === "renewal_spreadsheet")
    return { scope: "current_employer", authority: "rate_or_contribution", documentSubtype: documentType };
  if (documentType === "census")
    return { scope: "current_employer", authority: "employer_eligibility", documentSubtype: "employee_census" };
  if (documentType === "benefit_guide") {
    if (/\b(?:template|sample|example employer|insert employer|placeholder)\b/.test(normalized))
      return { scope: "master_template", authority: "approved_boilerplate", documentSubtype: "master_booklet_template" };
    return detectedEmployer
      ? { scope: "current_employer", authority: "employer_selection", documentSubtype: "current_employer_guide" }
      : { scope: "unknown", authority: "unknown", documentSubtype: "unscoped_benefit_guide" };
  }
  if (["sbc", "spd", "plan_summary"].includes(documentType)) {
    if (/\b(?:formulary|performance drug list|prescription drug list)\b/.test(normalized))
      return {
        scope: "generic_reference",
        authority: "administrator_material",
        documentSubtype: "prescription_formulary",
      };
    if (/\b(?:marketing brochure|product flyer|generic overview|sample benefits)\b/.test(normalized))
      return { scope: "generic_reference", authority: "generic_marketing", documentSubtype: documentType };
    return detectedEmployer
      ? { scope: "current_employer", authority: "current_plan_document", documentSubtype: documentType }
      : { scope: "unknown", authority: "current_plan_document", documentSubtype: documentType };
  }
  return { scope: "unknown", authority: "unknown", documentSubtype: documentType };
}

function effectivePeriod(value: string, detectedYear: string | null) {
  const isoDates = [...value.matchAll(/\b(20\d{2})-(\d{2})-(\d{2})\b/g)].map(
    (match) => match[0],
  );
  if (isoDates.length >= 2)
    return { effectiveStart: isoDates[0], effectiveEnd: isoDates[1] };
  return detectedYear
    ? { effectiveStart: `${detectedYear}-01-01`, effectiveEnd: `${detectedYear}-12-31` }
    : { effectiveStart: null, effectiveEnd: null };
}

export function classifyDocument(file: LoadedUploadedFile): ClassifiedDocument {
  const classification = classifyFromSignals(file);
  const sample = file.textContent || "";
  const benefits = detectedBenefitTypes(`${file.fileName} ${sample}`.toLowerCase());
  const employer = sample.match(
    /(?:group\/business name|legal entity name|prepared for|employer)\s*[:\-]\s*([^\n]{2,100})/i,
  )?.[1];
  const carrier = `${file.fileName} ${sample}`.match(
    /\b(Excellus|UnitedHealthcare|United Health(?:care)?|UHC|Cigna|Aetna|MVP|Oxford)\b/i,
  )?.[1];
  const year = `${file.fileName} ${sample}`.match(/\b(20\d{2})\b/)?.[1];
  const detectedEmployer = employer?.trim() || null;
  const detectedPlanYear = year || null;
  const context = documentContext(
    classification.documentType,
    `${file.fileName} ${sample}`,
    detectedEmployer,
  );
  const period = effectivePeriod(`${file.fileName} ${sample}`, detectedPlanYear);
  return {
    fileId: file.id,
    ...classification,
    detectedBenefitTypes: benefits,
    detectedEmployer,
    detectedCarrier: carrier || null,
    detectedPlanYear,
    benefitTypes: detectBenefitTypes(`${file.fileName} ${sample}`, classification.documentType),
    ...context,
    employerOrGroupId: detectedEmployer,
    planOrProgramIds: [],
    ...period,
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
    "company_website",
    "unknown",
  ]),
  confidence: z.number().min(0).max(1),
  detectedBenefitTypes: z.array(z.enum([
    "medical", "dental", "vision", "life", "std", "ltd", "eap", "voluntary",
    "telemedicine", "hsa", "hra", "fsa",
  ])),
  detectedEmployer: z.string().nullable(),
  detectedCarrier: z.string().nullable(),
  detectedPlanYear: z.string().nullable(),
  reasoningSummary: z.string(),
  benefitTypes: z.array(z.enum([
    "medical", "dental", "vision", "life", "std", "ltd", "eap",
    "voluntary", "telemedicine", "hsa", "hra", "fsa",
  ])),
  documentSubtype: z.string(),
  scope: z.enum([
    "current_employer", "prior_employer", "generic_reference",
    "master_template", "regulatory", "unknown",
  ]),
  authority: z.enum([
    "current_plan_document", "current_amendment_or_rider", "employer_selection",
    "employer_eligibility", "rate_or_contribution", "administrator_material",
    "manual_answer", "regulatory_source", "approved_boilerplate",
    "prior_year_context", "generic_marketing", "unknown",
  ]),
  employerOrGroupId: z.string().nullable(),
  planOrProgramIds: z.array(z.string()),
  effectiveStart: z.string().nullable(),
  effectiveEnd: z.string().nullable(),
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
  const benefitBearingDocument = [
    "employer_application",
    "plan_summary",
    "sbc",
    "spd",
    "benefit_guide",
    "prior_booklet",
    "email_export",
  ].includes(heuristic.documentType);
  const enrichmentComplete =
    heuristic.scope !== "unknown" &&
    heuristic.authority !== "unknown" &&
    (!benefitBearingDocument || Boolean(heuristic.benefitTypes?.length));
  if ((heuristic.confidence >= 0.8 && enrichmentComplete) || !apiKey)
    return heuristic;
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
          "Classify this employee-benefits source document. Return document role, every directly addressed benefit family, employer/plan scope, effective period, and source authority as separate decisions. A blank form is still an employer_application but proves no filled fact. A generic carrier brochure is generic_reference. A current plan document can prove design but not employer selection. A prior guide is prior_year_context. PBO/worksite products belong to voluntary. Pediatric dental or vision inside a medical SBC does not activate standalone dental or vision. Leave uncertain scope or authority unknown. Use only visible evidence.",
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
  const parsed = response.output_parsed;
  const documentType =
    parsed.documentType === "unknown" &&
    parsed.authority === "current_plan_document" &&
    /\bcertificate(?: of insurance)?\b/i.test(
      `${parsed.documentSubtype} ${parsed.reasoningSummary}`,
    )
      ? "spd"
      : parsed.documentType;
  const parsedBenefitTypes =
    documentType === "sbc" && parsed.benefitTypes.includes("medical")
      ? parsed.benefitTypes.filter(
          (benefitType) =>
            benefitType !== "hsa" && benefitType !== "telemedicine",
        )
      : parsed.benefitTypes;
  const inferredBenefitTypes = detectBenefitTypes(
    `${file.fileName} ${file.storagePath} ${parsed.documentSubtype} ${parsed.reasoningSummary}`,
    documentType,
  );
  const benefitTypes = parsedBenefitTypes.length
    ? parsedBenefitTypes
    : inferredBenefitTypes;
  return { fileId: file.id, ...parsed, documentType, benefitTypes };
}
