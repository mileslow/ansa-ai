import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import type { z } from "zod";
import {
  CostsPhaseSchema,
  CoveragePhaseSchema,
  IdentityPhaseSchema,
  MedicalPlanAttributesSchema,
  TranscriptSchema,
  type MedicalPlanAttributes,
  type Transcript,
} from "./plan-schema";

export type ParsingState =
  | "queued"
  | "extracting characters"
  | "reading plan"
  | "extracting benefits"
  | "reading exclusions and examples"
  | "validating plan"
  | "complete"
  | "failed";

export type PlanPatch = {
  parsingState?: ParsingState;
  parsingPct?: number;
  status?: "queued" | "parsing" | "complete" | "failed";
  attributes?: Partial<MedicalPlanAttributes>;
  extraction?: Record<string, unknown>;
  error?: string | null;
  updatedAt?: string;
  completedAt?: string;
};

export interface PlanExtractionStore {
  updatePlan(patch: PlanPatch): Promise<void>;
  writeTextPage(page: { pageNumber: number; text: string }): Promise<void>;
}

type ResponsesParser = Pick<OpenAI, "responses">;

export type ExtractMedicalPlanOptions = {
  apiKey?: string;
  client?: ResponsesParser;
  model?: string;
  file: Buffer;
  fileName: string;
  store: PlanExtractionStore;
  progressIntervalMs?: number;
};

const SYSTEM_PROMPT = `You are a meticulous US medical-plan document extraction agent.
Extract only facts stated in the supplied document. Preserve plan wording for cost sharing,
limitations, exceptions, notices, and legal text. Never infer a benefit that is not stated.
Use null for unavailable scalar values and [] for unavailable lists. Include source page numbers.
Transcribe currency, percentages, visit limits, time periods, network tiers, and whether a
deductible applies exactly enough for a benefits professional to audit against the PDF.`;

const PROMPTS = {
  transcript: `Transcribe every meaningful character in this medical plan document page by page.
Include headings, table cells, footnotes, contact details, plan identifiers, and notices. Preserve
reading order. Do not summarize. Omit only repeated decorative headers and page-number furniture.`,
  identity: `Extract plan identity, coverage dates and population, carrier/product/network details,
all header and footer identifiers (including document codes printed at the bottom-left as planId),
all deductible and out-of-pocket rules, services covered before the deductible, specific
deductibles, network/referral/balance-billing rules, and every plan-document contact or URL.`,
  costs: `Extract every service row and every prescription drug tier. Do not collapse rows.
Represent each distinct network tier, facility/site-of-care variation, copay, coinsurance,
deductible rule, preauthorization rule, visit/unit/age limit, exception, and footnote.`,
  coverage: `Extract every excluded service, other covered service, limitation, legal/regulatory
statement, continuation and appeal right, language-access entry, coverage example, and remaining
  notice. Put any ambiguity, illegible text, or apparent contradiction in extractionWarnings.`,
};

function footerPlanId(transcript: Transcript) {
  for (const page of transcript.pages) {
    const match = page.text.match(
      /^\s*([A-Z0-9][A-Z0-9._/-]{7,})\s+Page\s+\d+\s+of\s+\d+\s*$/im,
    );
    if (match) return match[1];
  }
  return null;
}

function dataUrl(file: Buffer) {
  return `data:application/pdf;base64,${file.toString("base64")}`;
}

async function parsePhase<T extends z.ZodTypeAny>(
  client: ResponsesParser,
  model: string,
  fileData: string,
  fileName: string,
  schema: T,
  schemaName: string,
  prompt: string,
): Promise<z.infer<T>> {
  const response = await client.responses.parse({
    model,
    reasoning: { effort: "low" },
    input: [
      { role: "system", content: SYSTEM_PROMPT },
      {
        role: "user",
        content: [
          {
            type: "input_file",
            filename: fileName,
            file_data: fileData,
          },
          { type: "input_text", text: prompt },
        ],
      },
    ],
    text: { format: zodTextFormat(schema, schemaName) },
  });
  if (!response.output_parsed)
    throw new Error(`OpenAI returned no parsed output for ${schemaName}`);
  return response.output_parsed;
}

async function runWithProgress<T>(
  store: PlanExtractionStore,
  state: ParsingState,
  startPct: number,
  endPct: number,
  intervalMs: number,
  task: () => Promise<T>,
) {
  let pct = startPct;
  await store.updatePlan({
    status: "parsing",
    parsingState: state,
    parsingPct: pct,
    error: null,
    updatedAt: new Date().toISOString(),
  });
  const timer = intervalMs
    ? setInterval(() => {
        pct = Math.min(endPct - 1, pct + 1);
        void store.updatePlan({
          parsingState: state,
          parsingPct: pct,
          updatedAt: new Date().toISOString(),
        });
      }, intervalMs)
    : null;
  try {
    const result = await task();
    await store.updatePlan({
      parsingState: state,
      parsingPct: endPct,
      updatedAt: new Date().toISOString(),
    });
    return result;
  } finally {
    if (timer) clearInterval(timer);
  }
}

export async function extractMedicalPlan({
  apiKey,
  client = new OpenAI({ apiKey }),
  model = process.env.OPENAI_PLAN_MODEL || "gpt-5.4-mini",
  file,
  fileName,
  store,
  progressIntervalMs = 5000,
}: ExtractMedicalPlanOptions): Promise<MedicalPlanAttributes> {
  if (!file.length) throw new Error("The plan document is empty");
  const startedAt = new Date().toISOString();
  const fileData = dataUrl(file);
  try {
    await store.updatePlan({
      status: "parsing",
      parsingState: "extracting characters",
      parsingPct: 2,
      extraction: { model, startedAt, schemaVersion: 1 },
      error: null,
      updatedAt: startedAt,
    });

    const transcript: Transcript = await runWithProgress(
      store,
      "extracting characters",
      4,
      23,
      progressIntervalMs,
      () =>
        parsePhase(
          client,
          model,
          fileData,
          fileName,
          TranscriptSchema,
          "medical_plan_transcript",
          PROMPTS.transcript,
        ),
    );
    for (const page of transcript.pages) await store.writeTextPage(page);
    await store.updatePlan({
      extraction: { pageCount: transcript.pages.length },
      updatedAt: new Date().toISOString(),
    });

    const extractedIdentity = await runWithProgress(
      store,
      "reading plan",
      25,
      43,
      progressIntervalMs,
      () =>
        parsePhase(
          client,
          model,
          fileData,
          fileName,
          IdentityPhaseSchema,
          "medical_plan_identity",
          PROMPTS.identity,
        ),
    );
    const transcriptPlanId = footerPlanId(transcript);
    const identity =
      !extractedIdentity.identity.planId && transcriptPlanId
        ? {
            ...extractedIdentity,
            identity: {
              ...extractedIdentity.identity,
              planId: transcriptPlanId,
            },
          }
        : extractedIdentity;
    await store.updatePlan({
      attributes: identity,
      updatedAt: new Date().toISOString(),
    });

    const costs = await runWithProgress(
      store,
      "extracting benefits",
      45,
      70,
      progressIntervalMs,
      () =>
        parsePhase(
          client,
          model,
          fileData,
          fileName,
          CostsPhaseSchema,
          "medical_plan_costs",
          PROMPTS.costs,
        ),
    );
    await store.updatePlan({
      attributes: costs,
      updatedAt: new Date().toISOString(),
    });

    const coverage = await runWithProgress(
      store,
      "reading exclusions and examples",
      72,
      91,
      progressIntervalMs,
      () =>
        parsePhase(
          client,
          model,
          fileData,
          fileName,
          CoveragePhaseSchema,
          "medical_plan_coverage",
          PROMPTS.coverage,
        ),
    );
    await store.updatePlan({
      attributes: coverage,
      updatedAt: new Date().toISOString(),
    });

    await store.updatePlan({
      parsingState: "validating plan",
      parsingPct: 96,
      updatedAt: new Date().toISOString(),
    });
    const attributes = MedicalPlanAttributesSchema.parse({
      ...identity,
      ...costs,
      ...coverage,
    });
    const attributeBytes = Buffer.byteLength(JSON.stringify(attributes));
    if (attributeBytes > 850_000)
      throw new Error(
        `Structured plan attributes are too large for Firestore (${attributeBytes} bytes)`,
      );
    const completedAt = new Date().toISOString();
    await store.updatePlan({
      status: "complete",
      parsingState: "complete",
      parsingPct: 100,
      attributes,
      extraction: { model, startedAt, completedAt, schemaVersion: 1, attributeBytes },
      completedAt,
      error: null,
      updatedAt: completedAt,
    });
    return attributes;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Plan parsing failed";
    await store.updatePlan({
      status: "failed",
      parsingState: "failed",
      error: message,
      updatedAt: new Date().toISOString(),
    });
    throw error;
  }
}
