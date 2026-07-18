import type { MedicalPlanAttributes } from "./plan-schema";

export const DOCUMENT_TYPES = [
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
] as const;

export type DocumentType = (typeof DOCUMENT_TYPES)[number];
export type BenefitType =
  | "medical"
  | "dental"
  | "vision"
  | "life"
  | "std"
  | "ltd"
  | "eap"
  | "voluntary"
  | "telemedicine"
  | "hsa"
  | "hra"
  | "fsa";

export type ProcessingStatus =
  | "uploaded"
  | "processing"
  | "complete"
  | "unsupported"
  | "failed";

export type UploadedFile = {
  id: string;
  companyId: string;
  fileName: string;
  storagePath: string;
  mimeType: string;
  uploadedAt: string;
  sha256: string;
  processingStatus: ProcessingStatus;
};

export type LoadedUploadedFile = UploadedFile & {
  data: Buffer;
  /** Useful for email bodies, tests, and already-extracted/OCR text. */
  textContent?: string;
};

export type SourceRef = {
  fileId: string;
  fileName: string;
  documentType: DocumentType | "manual_answer";
  page?: number;
  sheet?: string;
  row?: number;
  textRange?: string;
  extractionMethod?: "pdf_text" | "ocr" | "spreadsheet" | "model" | "manual";
};

export type ClassifiedDocument = {
  fileId: string;
  documentType: DocumentType;
  confidence: number;
  detectedEmployer?: string | null;
  detectedCarrier?: string | null;
  detectedPlanYear?: string | null;
  reasoningSummary: string;
};

export type ExtractedFact = {
  id: string;
  companyId: string;
  fileId: string;
  documentType: DocumentType | "manual_answer";
  path: string;
  value: unknown;
  normalizedValue: unknown;
  confidence: number;
  source: SourceRef;
  extractionMethod: SourceRef["extractionMethod"];
  createdAt: string;
};

export type ContributionMode = "percent" | "flat_monthly" | "flat_per_pay";

export type ContributionRule = {
  benefitType: BenefitType;
  planId?: string | null;
  planName?: string | null;
  tier: string;
  employeeClass?: string | null;
  mode: ContributionMode;
  value: number;
  payPeriods: number;
  sourceRefs: SourceRef[];
  confidence?: number;
};

export type RateTier = {
  tier: string;
  monthlyPremium: number;
  employerMonthly?: number | null;
  employeeMonthly?: number | null;
  enrolled?: number | null;
};

export type CarrierRatePlan = {
  id: string;
  benefitType: BenefitType;
  carrier?: string | null;
  state?: string | null;
  marketSegment?: string | null;
  quarter?: string | null;
  effectiveDate?: string | null;
  planName: string;
  productType?: string | null;
  metalTier?: string | null;
  network?: string | null;
  rateArea?: string | null;
  tiers: RateTier[];
  sourceFile: string;
  sourceFileId: string;
  sourceSheet: string;
  sourceRow: number;
  confidence: number;
  employerSpecific: boolean;
  planDetails?: Record<string, string | null>;
};

export type BenefitPlan = {
  id: string;
  benefitType: BenefitType;
  name: string;
  carrier?: string | null;
  year?: string | null;
  ratePlanId?: string | null;
  attributes?: MedicalPlanAttributes | null;
  sourceRefs: SourceRef[];
  confidence: number;
};

export type CompanyOffering = {
  benefitType: BenefitType;
  offered: boolean;
  selectedPlans: string[];
  eligibilityRule?: string | null;
  contributionRules: ContributionRule[];
  contacts: Contact[];
  sourceRefs: SourceRef[];
  confidence: number;
};

export type Contact = {
  role: string;
  name?: string | null;
  organization?: string | null;
  phone?: string | null;
  email?: string | null;
  website?: string | null;
  sourceRefs: SourceRef[];
};

export type Conflict = {
  fieldPath: string;
  description: string;
  values: Array<{ value: unknown; sourceRefs: SourceRef[]; confidence: number }>;
  resolution?: string | null;
  blocking: boolean;
};

export type ConfidenceReport = {
  overall: number;
  fields: Record<string, number>;
  sources: SourceRef[];
  warnings: string[];
  assumptions: string[];
  conflicts: Conflict[];
  manualAnswers: string[];
};

export type BenefitsPackage = {
  employer: {
    name: string;
    legalName?: string | null;
    address?: string | null;
    website?: string | null;
  };
  planYear: { start: string; end: string; label: string };
  eligibility: {
    waitingPeriod?: string | null;
    description?: string | null;
    employeeClasses: string[];
  };
  offeredBenefits: CompanyOffering[];
  plans: BenefitPlan[];
  rates: CarrierRatePlan[];
  contributions: ContributionRule[];
  contacts: Contact[];
  accounts: Array<{
    type: "hsa" | "hra" | "fsa";
    administrator?: string | null;
    sourceRefs: SourceRef[];
  }>;
  bookletStyle: {
    templateName?: string | null;
    sectionOrder: string[];
    sourceRefs: SourceRef[];
  };
  sourceMap: Record<string, SourceRef[]>;
  confidenceReport: ConfidenceReport;
};

export type BookletSection = {
  id: string;
  title: string;
  benefitType?: BenefitType;
  sourceRefs: SourceRef[];
};

export type BookletOutline = { sections: BookletSection[] };

export type BlockerQuestion = {
  id: string;
  fieldPath: string;
  question: string;
  reason: string;
  options?: string[];
  recommendedAnswer?: unknown;
  sourceRefs: SourceRef[];
  blocking: boolean;
};

export const PIPELINE_STAGES = [
  "Uploading files",
  "Classifying documents",
  "Extracting employer setup",
  "Reading carrier rate sheets",
  "Parsing plan documents",
  "Reading prior booklets/guides",
  "Matching rates to plans",
  "Detecting offered benefits",
  "Resolving conflicts",
  "Building booklet outline",
  "Writing booklet content",
  "Rendering PDF",
  "Running quality checks",
  "Complete",
] as const;

export type PipelineStage = (typeof PIPELINE_STAGES)[number];
export type PipelineEvent = {
  id: string;
  runId: string;
  stage: PipelineStage;
  status: "started" | "progress" | "complete" | "warning";
  message: string;
  createdAt: string;
  details?: Record<string, unknown>;
};

export type BookletGenerationRun = {
  id: string;
  threadId: string;
  companyId: string;
  status: "queued" | "processing" | "blocked" | "complete" | "failed";
  uploadedFileIds: string[];
  stages: PipelineEvent[];
  questions: BlockerQuestion[];
  answers: Record<string, unknown>;
  benefitsPackageSnapshot?: BenefitsPackage | null;
  bookletOutline?: BookletOutline | null;
  pdfStoragePath?: string | null;
  pdfUrl?: string | null;
  confidenceReport?: ConfidenceReport | null;
  createdAt: string;
  completedAt?: string | null;
  error?: string | null;
};
