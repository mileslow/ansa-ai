import { createHash } from "node:crypto";
import * as XLSX from "xlsx";
import type {
  BenefitType,
  CarrierRatePlan,
  ContributionRule,
  ExtractedFact,
  LoadedUploadedFile,
  RateTier,
  SourceRef,
} from "./booklet-types";

type Cell = string | number | boolean | Date | null | undefined;
type Rows = Cell[][];

const clean = (value: Cell) => String(value ?? "").replace(/\s+/g, " ").trim();
const key = (value: Cell) => clean(value).toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const amount = (value: Cell) => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const parsed = Number(clean(value).replace(/[$,%()\s,]/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
};
const id = (...parts: string[]) =>
  createHash("sha1").update(parts.join("|")).digest("hex").slice(0, 20);

export function normalizeTier(value: Cell) {
  const normalized = key(value);
  if (/^(ee|employee|single)$/.test(normalized)) return "employee";
  if (/spouse/.test(normalized)) return "employee_spouse";
  if (/child/.test(normalized)) return "employee_children";
  if (/family/.test(normalized)) return "family";
  return normalized.replace(/\s+/g, "_") || "unknown";
}

function benefitType(planName: string, sheetName: string): BenefitType {
  const value = `${planName} ${sheetName}`.toLowerCase();
  if (/dental/.test(value)) return "dental";
  if (/vision/.test(value)) return "vision";
  if (/\blife\b|ad&d/.test(value)) return "life";
  if (/short.?term|\bstd\b/.test(value)) return "std";
  if (/long.?term|\bltd\b/.test(value)) return "ltd";
  return "medical";
}

function source(file: LoadedUploadedFile, sheet: string, row: number): SourceRef {
  return {
    fileId: file.id,
    fileName: file.fileName,
    documentType: /renewal|cost per month/i.test(file.fileName)
      ? "renewal_spreadsheet"
      : "carrier_rate_sheet",
    sheet,
    row,
    extractionMethod: "spreadsheet",
  };
}

function findHeader(rows: Rows, required: string[]) {
  return rows.findIndex((row) => {
    const cells = row.map(key);
    return required.every((term) => cells.some((cell) => cell === term || cell.includes(term)));
  });
}

function inferCarrier(fileName: string, rows: Rows) {
  const sample = `${fileName} ${rows.slice(0, 8).flat().map(clean).join(" ")}`;
  return sample.match(/\b(Excellus|Healthy NY|UnitedHealthcare|UHC|Cigna|Aetna|MVP|Oxford)\b/i)?.[1] || null;
}

function inferEffectiveDate(rows: Rows) {
  const sample = rows.slice(0, 8).flat().map(clean).join(" ");
  const range = sample.match(/(\d{1,2}\/\d{1,2}\/20\d{2})\s*-\s*(\d{1,2}\/\d{1,2}\/20\d{2})/);
  return range?.[1] || sample.match(/\b(20\d{2})\b/)?.[1] || null;
}

function inferQuarter(effectiveDate: string | null) {
  if (!effectiveDate) return null;
  const match = effectiveDate.match(/^(\d{1,2})\//);
  if (!match) return null;
  return `Q${Math.ceil(Number(match[1]) / 3)}`;
}

function parseCostSummary(
  file: LoadedUploadedFile,
  sheetName: string,
  rows: Rows,
): { plans: CarrierRatePlan[]; contributions: ContributionRule[] } {
  const headerIndex = findHeader(rows, ["plan", "tier", "monthly premium", "er cost"]);
  if (headerIndex < 0) return { plans: [], contributions: [] };
  const headers = rows[headerIndex].map(key);
  const column = (pattern: RegExp) => headers.findIndex((header) => pattern.test(header));
  const planColumn = column(/^plan$/);
  const tierColumn = column(/^tier$/);
  const premiumColumn = column(/monthly premium/);
  const employerColumn = column(/^er cost|employer cost/);
  const employeeColumn = column(/^ee cost|employee cost/);
  const enrolledColumn = column(/enrolled/);
  const percentColumn = column(
    /^(?:er|er percent|er percentage|employer percent|employer percentage)$/,
  );
  if ([planColumn, tierColumn, premiumColumn, employerColumn].some((index) => index < 0))
    return { plans: [], contributions: [] };

  const groups = new Map<string, { start: number; tiers: RateTier[] }>();
  let currentPlan = "";
  for (let rowIndex = headerIndex + 1; rowIndex < rows.length; rowIndex += 1) {
    const row = rows[rowIndex];
    const planCell = clean(row[planColumn]);
    if (/total$/i.test(planCell)) {
      currentPlan = "";
      continue;
    }
    if (planCell) currentPlan = planCell;
    const tierName = normalizeTier(row[tierColumn]);
    const premium = amount(row[premiumColumn]);
    if (!currentPlan || tierName === "unknown" || premium === null) continue;
    const employerMonthly = amount(row[employerColumn]);
    const employeeMonthly = employeeColumn >= 0 ? amount(row[employeeColumn]) : null;
    const enrolled = enrolledColumn >= 0 ? amount(row[enrolledColumn]) : null;
    const group = groups.get(currentPlan) || { start: rowIndex + 1, tiers: [] };
    group.tiers.push({ tier: tierName, monthlyPremium: premium, employerMonthly, employeeMonthly, enrolled });
    groups.set(currentPlan, group);
  }

  const payPeriods = /26/.test(sheetName) ? 26 : /24/.test(sheetName) ? 24 : /monthly/i.test(sheetName) ? 12 : 52;
  const carrier = inferCarrier(file.fileName, rows);
  const plans: CarrierRatePlan[] = [];
  const contributions: ContributionRule[] = [];
  for (const [planName, group] of groups) {
    const type = benefitType(planName, sheetName);
    const planId = id(file.id, sheetName, planName);
    plans.push({
      id: planId,
      benefitType: type,
      carrier,
      state: null,
      marketSegment: null,
      quarter: null,
      effectiveDate: planName.match(/\b20\d{2}\b/)?.[0] || null,
      planName,
      productType: null,
      metalTier: planName.match(/\b(bronze|silver|gold|platinum)\b/i)?.[1] || null,
      network: null,
      rateArea: null,
      tiers: group.tiers,
      sourceFile: file.fileName,
      sourceFileId: file.id,
      sourceSheet: sheetName,
      sourceRow: group.start,
      confidence: 0.98,
      employerSpecific: true,
    });
    group.tiers.forEach((tier, index) => {
      if (tier.employerMonthly === null || tier.employerMonthly === undefined) return;
      const rawPercent = percentColumn >= 0 ? amount(rows[group.start + index - 1]?.[percentColumn]) : null;
      const normalizedPercent =
        rawPercent === null ? null : rawPercent / (rawPercent > 1 ? 100 : 1);
      const percentMatchesEmployerCost =
        normalizedPercent !== null &&
        Math.abs(tier.monthlyPremium * normalizedPercent - tier.employerMonthly) <= 0.02;
      contributions.push({
        benefitType: type,
        planId,
        planName,
        tier: tier.tier,
        employeeClass: null,
        mode: percentMatchesEmployerCost ? "percent" : "flat_monthly",
        value: percentMatchesEmployerCost ? normalizedPercent! : tier.employerMonthly,
        payPeriods,
        sourceRefs: [source(file, sheetName, group.start + index)],
        confidence: 0.98,
      });
    });
  }
  return { plans, contributions };
}

function parseMatrixRateTable(
  file: LoadedUploadedFile,
  sheetName: string,
  rows: Rows,
): CarrierRatePlan[] {
  const explicitPlanRow = rows.findIndex((row) => key(row[0]) === "plan name");
  const singleRow = rows.findIndex((row) => /^(single|employee|ee)$/.test(key(row[0])));
  const planRow = explicitPlanRow >= 0 ? explicitPlanRow : singleRow === 1 ? 0 : -1;
  if (planRow < 0 || singleRow < 0) return [];
  const spouseRow = rows.findIndex((row) => /spouse/.test(key(row[0])));
  const childrenRow = rows.findIndex((row) => /child/.test(key(row[0])));
  const familyRow = rows.findIndex((row) => key(row[0]) === "family");
  if ([spouseRow, childrenRow, familyRow].some((index) => index < 0)) return [];
  const effectiveRow = rows.findIndex((row) => /effective/.test(key(row[0])));
  const planTypeRow = rows.findIndex((row) => key(row[0]) === "plan type");
  const hsaRow = rows.findIndex((row) => key(row[0]) === "hsa eligible");
  const carrier = inferCarrier(file.fileName, rows);
  const plans: CarrierRatePlan[] = [];
  for (let column = 1; column < Math.max(...rows.map((row) => row.length)); column += 1) {
    const planName = clean(rows[planRow]?.[column]);
    const single = amount(rows[singleRow]?.[column]);
    if (!planName || single === null) continue;
    const tiers = [
      { tier: "employee", monthlyPremium: single },
      { tier: "employee_spouse", monthlyPremium: amount(rows[spouseRow]?.[column]) },
      { tier: "employee_children", monthlyPremium: amount(rows[childrenRow]?.[column]) },
      { tier: "family", monthlyPremium: amount(rows[familyRow]?.[column]) },
    ].filter((tier): tier is RateTier => tier.monthlyPremium !== null);
    if (tiers.length < 4) continue;
    const effectiveDate = effectiveRow >= 0 ? clean(rows[effectiveRow]?.[column]) || null : null;
    plans.push({
      id: id(file.id, sheetName, planName, String(column)),
      benefitType: benefitType(planName, sheetName),
      carrier,
      state: /new york|\bny\b/i.test(`${file.fileName} ${sheetName}`) ? "NY" : null,
      marketSegment: null,
      quarter: inferQuarter(effectiveDate),
      effectiveDate,
      planName,
      productType: planTypeRow >= 0 ? clean(rows[planTypeRow]?.[column]) || null : null,
      metalTier: planName.match(/\b(bronze|silver|gold|platinum)\b/i)?.[1] || null,
      network: null,
      rateArea: null,
      tiers,
      sourceFile: file.fileName,
      sourceFileId: file.id,
      sourceSheet: sheetName,
      sourceRow: planRow + 1,
      confidence: 0.94,
      employerSpecific: false,
      planDetails: hsaRow >= 0 ? { "hsa eligible": clean(rows[hsaRow]?.[column]) || null } : {},
    });
  }
  return plans;
}

function parseWideRateTable(
  file: LoadedUploadedFile,
  sheetName: string,
  rows: Rows,
): CarrierRatePlan[] {
  const headerIndex = findHeader(rows, ["plan name", "single rate", "family rate"]);
  if (headerIndex < 0) return [];
  const headers = rows[headerIndex].map(key);
  const column = (pattern: RegExp) => headers.findIndex((header) => pattern.test(header));
  const planColumn = column(/^plan name$/);
  const tierColumns = [
    ["employee", column(/^single rate$/)],
    ["employee_spouse", column(/subscriber and spouse rate/)],
    ["employee_children", column(/subscriber and children rate/)],
    ["family", column(/^family rate$/)],
  ] as const;
  const effectiveDate = inferEffectiveDate(rows);
  const quarter = inferQuarter(effectiveDate);
  const carrier = inferCarrier(file.fileName, rows);
  const plans: CarrierRatePlan[] = [];
  for (let rowIndex = headerIndex + 1; rowIndex < rows.length; rowIndex += 1) {
    const row = rows[rowIndex];
    const planName = clean(row[planColumn]);
    if (!planName) continue;
    const tiers = tierColumns.flatMap(([tier, index]) => {
      const monthlyPremium = index >= 0 ? amount(row[index]) : null;
      return monthlyPremium === null ? [] : [{ tier, monthlyPremium }];
    });
    if (!tiers.length) continue;
    const details: Record<string, string | null> = {};
    for (const label of [
      "primary care office visit",
      "specialist office visit",
      "deductible",
      "coinsurance",
      "hospital benefits",
      "emergency room care",
      "prescription drug coverage",
      "out of pocket maximum",
    ]) {
      const index = headers.findIndex((header) => header === label);
      if (index >= 0) details[label] = clean(row[index]) || null;
    }
    plans.push({
      id: id(file.id, sheetName, planName, String(rowIndex + 1)),
      benefitType: benefitType(planName, sheetName),
      carrier,
      state: /new york|\bny\b/i.test(file.fileName) ? "NY" : null,
      marketSegment: null,
      quarter,
      effectiveDate,
      planName,
      productType: clean(row[column(/^plan type$/)]) || null,
      metalTier: planName.match(/\b(bronze|silver|gold|platinum)\b/i)?.[1] || null,
      network: null,
      rateArea: clean(rows.find((candidate) => key(candidate[1]) === "region")?.[2]) || null,
      tiers,
      sourceFile: file.fileName,
      sourceFileId: file.id,
      sourceSheet: sheetName,
      sourceRow: rowIndex + 1,
      confidence: 0.97,
      employerSpecific: false,
      planDetails: details,
    });
  }
  return plans;
}

function factsFromPlans(file: LoadedUploadedFile, plans: CarrierRatePlan[]): ExtractedFact[] {
  return plans.flatMap((plan) => {
    const base = source(file, plan.sourceSheet, plan.sourceRow);
    return [
      {
        id: id(plan.id, "planName"),
        companyId: file.companyId,
        fileId: file.id,
        documentType: base.documentType,
        path: `rates[${plan.id}].planName`,
        value: plan.planName,
        normalizedValue: plan.planName.toLowerCase(),
        confidence: plan.confidence,
        source: base,
        extractionMethod: "spreadsheet" as const,
        createdAt: new Date().toISOString(),
      },
      ...plan.tiers.map((tier) => ({
        id: id(plan.id, tier.tier, "premium"),
        companyId: file.companyId,
        fileId: file.id,
        documentType: base.documentType,
        path: `rates[${plan.id}].tiers.${tier.tier}.monthlyPremium`,
        value: tier.monthlyPremium,
        normalizedValue: tier.monthlyPremium,
        confidence: plan.confidence,
        source: base,
        extractionMethod: "spreadsheet" as const,
        createdAt: new Date().toISOString(),
      })),
    ];
  });
}

export function extractRateSheet(file: LoadedUploadedFile) {
  const workbook = XLSX.read(file.data, { type: "buffer", cellDates: true });
  const plans: CarrierRatePlan[] = [];
  const contributions: ContributionRule[] = [];
  const warnings: string[] = [];
  for (const sheetName of workbook.SheetNames) {
    const rows = XLSX.utils.sheet_to_json<Cell[]>(workbook.Sheets[sheetName], {
      header: 1,
      defval: null,
      raw: false,
    });
    const costSummary = parseCostSummary(file, sheetName, rows);
    plans.push(...costSummary.plans);
    contributions.push(...costSummary.contributions);
    if (!costSummary.plans.length) {
      const wide = parseWideRateTable(file, sheetName, rows);
      plans.push(...wide);
      if (!wide.length) plans.push(...parseMatrixRateTable(file, sheetName, rows));
    }
  }
  if (!plans.length) warnings.push(`No supported plan-rate table was found in ${file.fileName}.`);
  return { plans, contributions, facts: factsFromPlans(file, plans), warnings };
}
