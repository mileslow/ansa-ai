import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { loadEnv } from "vite";
import * as XLSX from "xlsx";

import { generateBookletPdfFromHtml } from "../lib/booklet";
import { runBookletPipeline } from "../lib/booklet-pipeline";
import type { LoadedUploadedFile, PipelineEvent } from "../lib/booklet-types";

const root = process.cwd();
const outputRoot = path.join(root, "test-info");
const employerDirectory = path.join(outputRoot, "01_employer-setup");
const ratesDirectory = path.join(outputRoot, "02_rates-and-contributions");
const medicalDirectory = path.join(outputRoot, "03_plan-documents", "medical");
const dentalDirectory = path.join(outputRoot, "03_plan-documents", "dental");
const bookletDirectory = path.join(outputRoot, "04_generated-booklet");

const companyId = "northstar-fabrication-test-2026";
const planYear = { start: "2026-01-01", end: "2026-12-31" };
const payPeriods = 26;

type RateRow = {
  plan: string;
  carrier: string;
  tier: "EE" | "EE+Spouse" | "EE+Children" | "EE+Family";
  premium: number;
  employer: number;
  enrolled: number;
};

const medicalRows: RateRow[] = [
  { plan: "2026 SimplyBlue Plus Bronze 4", carrier: "Excellus BlueCross BlueShield", tier: "EE", premium: 767.47, employer: 75, enrolled: 20 },
  { plan: "2026 SimplyBlue Plus Bronze 4", carrier: "Excellus BlueCross BlueShield", tier: "EE+Spouse", premium: 1534.94, employer: 75, enrolled: 7 },
  { plan: "2026 SimplyBlue Plus Bronze 4", carrier: "Excellus BlueCross BlueShield", tier: "EE+Children", premium: 1304.70, employer: 75, enrolled: 6 },
  { plan: "2026 SimplyBlue Plus Bronze 4", carrier: "Excellus BlueCross BlueShield", tier: "EE+Family", premium: 2187.29, employer: 75, enrolled: 7 },
  { plan: "2026 SimplyBlue Plus Silver 19", carrier: "Excellus BlueCross BlueShield", tier: "EE", premium: 964.11, employer: 75, enrolled: 22 },
  { plan: "2026 SimplyBlue Plus Silver 19", carrier: "Excellus BlueCross BlueShield", tier: "EE+Spouse", premium: 1928.22, employer: 75, enrolled: 8 },
  { plan: "2026 SimplyBlue Plus Silver 19", carrier: "Excellus BlueCross BlueShield", tier: "EE+Children", premium: 1638.99, employer: 75, enrolled: 7 },
  { plan: "2026 SimplyBlue Plus Silver 19", carrier: "Excellus BlueCross BlueShield", tier: "EE+Family", premium: 2747.72, employer: 75, enrolled: 7 },
  { plan: "2026 SimplyBlue Plus Gold 6", carrier: "Excellus BlueCross BlueShield", tier: "EE", premium: 1121.11, employer: 75, enrolled: 10 },
  { plan: "2026 SimplyBlue Plus Gold 6", carrier: "Excellus BlueCross BlueShield", tier: "EE+Spouse", premium: 2242.21, employer: 75, enrolled: 4 },
  { plan: "2026 SimplyBlue Plus Gold 6", carrier: "Excellus BlueCross BlueShield", tier: "EE+Children", premium: 1905.88, employer: 75, enrolled: 3 },
  { plan: "2026 SimplyBlue Plus Gold 6", carrier: "Excellus BlueCross BlueShield", tier: "EE+Family", premium: 3195.15, employer: 75, enrolled: 3 },
];

const dentalRows: RateRow[] = [
  { plan: "2026 Delta Dental Basic Family PPO Plan I", carrier: "Delta Dental", tier: "EE", premium: 46.00, employer: 23.00, enrolled: 30 },
  { plan: "2026 Delta Dental Basic Family PPO Plan I", carrier: "Delta Dental", tier: "EE+Spouse", premium: 92.00, employer: 23.00, enrolled: 10 },
  { plan: "2026 Delta Dental Basic Family PPO Plan I", carrier: "Delta Dental", tier: "EE+Children", premium: 96.22, employer: 23.00, enrolled: 10 },
  { plan: "2026 Delta Dental Basic Family PPO Plan I", carrier: "Delta Dental", tier: "EE+Family", premium: 152.31, employer: 23.00, enrolled: 10 },
  { plan: "2026 Delta Dental Enhanced Family PPO Plan III", carrier: "Delta Dental", tier: "EE", premium: 63.40, employer: 31.70, enrolled: 18 },
  { plan: "2026 Delta Dental Enhanced Family PPO Plan III", carrier: "Delta Dental", tier: "EE+Spouse", premium: 126.80, employer: 31.70, enrolled: 6 },
  { plan: "2026 Delta Dental Enhanced Family PPO Plan III", carrier: "Delta Dental", tier: "EE+Children", premium: 132.65, employer: 31.70, enrolled: 6 },
  { plan: "2026 Delta Dental Enhanced Family PPO Plan III", carrier: "Delta Dental", tier: "EE+Family", premium: 209.95, employer: 31.70, enrolled: 6 },
];

const money = (value: number) => `$${value.toFixed(2)}`;
const employeeMonthly = (row: RateRow) => Math.max(0, row.premium - row.employer);
const perPay = (row: RateRow) => employeeMonthly(row) * 12 / payPeriods;
const sha256 = (data: Buffer) => createHash("sha256").update(data).digest("hex");

const htmlEscape = (value: string) => value
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;");

const sharedCss = `
  <style>
    @page { size: Letter; margin: 0; }
    * { box-sizing: border-box; }
    body { margin: 0; color: #172235; font-family: Arial, Helvetica, sans-serif; background: #eef2f6; }
    section[data-page-id] { width: 8.5in; height: 11in; padding: .54in .58in .48in; background: white; position: relative; page-break-after: always; overflow: hidden; }
    section[data-page-id]:last-child { page-break-after: auto; }
    .eyebrow { color: #126e72; font-size: 9px; font-weight: 800; letter-spacing: 1.4px; text-transform: uppercase; }
    h1 { font-size: 27px; line-height: 1.06; margin: 8px 0 8px; color: #123d4a; }
    h2 { font-size: 17px; line-height: 1.15; color: #123d4a; margin: 14px 0 7px; }
    h3 { font-size: 11px; color: #126e72; margin: 0 0 5px; text-transform: uppercase; letter-spacing: .5px; }
    p, li { font-size: 9.2px; line-height: 1.38; margin: 0 0 6px; }
    ul { margin: 4px 0 8px 17px; padding: 0; }
    .subhead { color: #526274; font-size: 10.5px; margin-bottom: 12px; }
    .banner { background: #123d4a; color: #fff; padding: 9px 12px; margin: -2px 0 12px; font-weight: 700; font-size: 10px; }
    .synthetic { color: #8c3d12; background: #fff1e7; border: 1px solid #efc6a9; padding: 7px 10px; font-size: 8.5px; font-weight: 700; margin-bottom: 11px; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 9px; }
    .grid.three { grid-template-columns: repeat(3, 1fr); }
    .card { border: 1px solid #d4dee6; border-radius: 6px; padding: 9px 10px; break-inside: avoid; }
    .card.tint { background: #f1f8f8; border-color: #bdd8d8; }
    .field { display: grid; grid-template-columns: 38% 62%; border-bottom: 1px solid #e2e8ed; padding: 4px 0; font-size: 8.7px; line-height: 1.25; }
    .field:last-child { border-bottom: 0; }
    .label { color: #59697a; font-weight: 700; }
    .value { color: #152435; }
    table { width: 100%; border-collapse: collapse; margin: 6px 0 10px; table-layout: fixed; }
    th { background: #123d4a; color: white; padding: 5px 5px; text-align: left; font-size: 7.6px; line-height: 1.15; }
    td { border-bottom: 1px solid #dce4ea; padding: 4px 5px; font-size: 7.7px; line-height: 1.2; vertical-align: top; }
    tr:nth-child(even) td { background: #f6f8fa; }
    .check { font-weight: 800; color: #126e72; }
    .muted { color: #687788; }
    .small { font-size: 7.6px; line-height: 1.3; }
    .metric { font-size: 19px; font-weight: 800; color: #123d4a; }
    .footer { position: absolute; bottom: .24in; left: .58in; right: .58in; display: flex; justify-content: space-between; border-top: 1px solid #d9e2e8; padding-top: 5px; color: #758391; font-size: 7px; }
  </style>`;

function documentHtml(title: string, pages: string[]) {
  return `<!doctype html><html><head><meta charset="utf-8"><title>${htmlEscape(title)}</title>${sharedCss}</head><body>${pages.join("\n")}</body></html>`;
}

function footer(label: string, page: number, total: number) {
  return `<div class="footer"><span>${htmlEscape(label)}</span><span>PAGE ${page} OF ${total}</span></div>`;
}

function applicationHtml() {
  const medicalRateTable = medicalRows.map((row) => `<tr><td>${row.plan.replace("2026 SimplyBlue Plus ", "")}</td><td>${row.tier}</td><td>${money(row.premium)}</td><td>${money(row.employer)}</td><td>${money(employeeMonthly(row))}</td><td>${money(perPay(row))}</td></tr>`).join("");
  const dentalRateTable = dentalRows.map((row) => `<tr><td>${row.plan.replace("2026 Delta Dental ", "")}</td><td>${row.tier}</td><td>${money(row.premium)}</td><td>${money(row.employer)}</td><td>${money(employeeMonthly(row))}</td><td>${money(perPay(row))}</td></tr>`).join("");
  return documentHtml("Northstar Fabrication 2026 Synthetic Employer Benefits Application", [
    `<section data-page-id="application-1">
      <div class="eyebrow">Completed employer benefits application</div><h1>Northstar Fabrication</h1>
      <div class="subhead">2026 plan year · Application NFAB-2026-0002 · Submitted October 24, 2025</div>
      <div class="synthetic">SYNTHETIC / NOT A REAL EMPLOYER. All entities, identifiers, contacts, selections, rates, and signatures in this fixture are invented.</div>
      <div class="grid">
        <div class="card"><h3>Employer identity</h3>
          <div class="field"><span class="label">Legal name</span><span class="value">Northstar Fabrication Test Company</span></div>
          <div class="field"><span class="label">DBA</span><span class="value">Northstar Fabrication</span></div>
          <div class="field"><span class="label">FEIN</span><span class="value">99-0000123 (fictional)</span></div>
          <div class="field"><span class="label">State ID</span><span class="value">ID-TEST-88421</span></div>
          <div class="field"><span class="label">Business</span><span class="value">C corporation · Precision metal fabrication</span></div>
          <div class="field"><span class="label">Address</span><span class="value">2400 Foundry Loop, Boise, ID 83702</span></div>
          <div class="field"><span class="label">Website</span><span class="value">northstar-fabrication.test</span></div>
        </div>
        <div class="card tint"><h3>Plan administration</h3>
          <div class="field"><span class="label">Plan year</span><span class="value">January 1–December 31, 2026</span></div>
          <div class="field"><span class="label">Effective date</span><span class="value">January 1, 2026</span></div>
          <div class="field"><span class="label">Open enrollment</span><span class="value">November 3–14, 2025</span></div>
          <div class="field"><span class="label">Enrollment method</span><span class="value">Northstar Benefits Portal</span></div>
          <div class="field"><span class="label">Payroll</span><span class="value">Biweekly · 26 deductions/year</span></div>
          <div class="field"><span class="label">First deduction</span><span class="value">December 19, 2025</span></div>
          <div class="field"><span class="label">Tax treatment</span><span class="value">Medical and dental deductions pre-tax under Section 125</span></div>
        </div>
      </div>
      <h2>Workforce and eligibility</h2>
      <div class="grid three">
        <div class="card"><div class="metric">148</div><p>Total employees</p><div class="metric">117</div><p>Benefits eligible</p></div>
        <div class="card"><div class="metric">104</div><p>Expected enrolling</p><div class="metric">13</div><p>Expected waiving</p></div>
        <div class="card"><div class="metric">2</div><p>Work locations</p><div class="metric">38</div><p>Average full-time hours</p></div>
      </div>
      <div class="grid" style="margin-top:9px">
        <div class="card"><h3>Eligible employees</h3><p>Regular employees scheduled to work at least 30 hours per week.</p><p><b>Waiting period:</b> coverage begins the first day of the month after 30 calendar days of employment.</p><p><b>Rehire:</b> waiting period is waived when rehired within 13 weeks.</p></div>
        <div class="card"><h3>Eligible dependents</h3><p>Spouse, domestic partner, and eligible children through the end of the month in which they turn age 26. Supporting documentation may be required.</p><p>Employees must notify HR within 30 days of a qualifying life event.</p></div>
      </div>
      ${footer("NORTHSTAR FABRICATION · SYNTHETIC APPLICATION", 1, 3)}
    </section>`,
    `<section data-page-id="application-2">
      <div class="eyebrow">Benefit elections</div><h1>Selected 2026 offerings</h1>
      <div class="banner">Only medical and dental coverage is offered in this test case.</div>
      <div class="grid">
        <div class="card tint"><h3>Medical · three employee choices</h3>
          <p class="check">☒ 2026 SimplyBlue Plus Bronze 4</p><p class="check">☒ 2026 SimplyBlue Plus Silver 19</p><p class="check">☒ 2026 SimplyBlue Plus Gold 6</p>
          <p>Carrier: Excellus BlueCross BlueShield. Employer contribution: a flat $75.00 per month for every coverage tier and every selected medical option.</p>
        </div>
        <div class="card tint"><h3>Dental · two employee choices</h3>
          <p class="check">☒ 2026 Delta Dental Basic Family PPO Plan I</p><p class="check">☒ 2026 Delta Dental Enhanced Family PPO Plan III</p>
          <p>Carrier: Delta Dental. Employer credit: 50% of each option's employee-only premium, applied as a flat monthly credit to all tiers ($23.00 Basic; $31.70 Enhanced).</p>
        </div>
      </div>
      <h2>Medical monthly rates and deductions</h2>
      <table><thead><tr><th style="width:25%">Plan</th><th>Tier</th><th>Premium</th><th>Employer</th><th>Employee/mo.</th><th>Employee/pay</th></tr></thead><tbody>${medicalRateTable}</tbody></table>
      <h2>Dental monthly rates and deductions</h2>
      <table><thead><tr><th style="width:25%">Plan</th><th>Tier</th><th>Premium</th><th>Employer</th><th>Employee/mo.</th><th>Employee/pay</th></tr></thead><tbody>${dentalRateTable}</tbody></table>
      <p class="small muted">Per-pay deductions equal (monthly premium − employer monthly contribution) × 12 ÷ 26, rounded to cents for display. The accompanying workbook contains formula cells and unrounded annual calculations.</p>
      ${footer("NORTHSTAR FABRICATION · SYNTHETIC APPLICATION", 2, 3)}
    </section>`,
    `<section data-page-id="application-3">
      <div class="eyebrow">Enrollment and certification</div><h1>Administration details</h1>
      <div class="grid">
        <div class="card"><h3>Employee enrollment instructions</h3><ol style="margin:4px 0 6px 18px;padding:0"><li>Review the three medical and two dental choices.</li><li>Sign in to the Northstar Benefits Portal during November 3–14, 2025.</li><li>Elect or waive medical and dental separately and add eligible dependents.</li><li>Review the confirmation statement before submitting.</li><li>Save the confirmation for your records.</li></ol><p>Employees who do not enroll during the window generally must wait until the next open enrollment unless they experience an eligible qualifying life event.</p></div>
        <div class="card tint"><h3>Benefits contact</h3>
          <div class="field"><span class="label">Contact</span><span class="value">Avery Chen, Synthetic HR Director</span></div>
          <div class="field"><span class="label">Email</span><span class="value">benefits@northstar-fabrication.test</span></div>
          <div class="field"><span class="label">Direct phone</span><span class="value">208-555-0112</span></div>
          <div class="field"><span class="label">Main phone</span><span class="value">208-555-0106</span></div>
          <div class="field"><span class="label">Portal</span><span class="value">benefits.northstar-fabrication.test</span></div>
        </div>
      </div>
      <h2>Explicit non-offerings</h2>
      <div class="card"><p><b>Not offered:</b> vision, basic life, AD&amp;D, voluntary life, short-term disability, long-term disability, accident, critical illness, hospital indemnity, telemedicine as a standalone benefit, employee assistance program, HSA funding or administration, HRA, health FSA, limited-purpose FSA, and dependent-care FSA.</p><p>Medical plan documents may describe HSA compatibility as a plan-design characteristic. Northstar does not sponsor or fund a separate HSA benefit in this synthetic scenario.</p></div>
      <h2>Employer certification</h2>
      <div class="card"><p>I certify that the plan selections, effective dates, eligibility rules, employer contributions, payroll frequency, employee enrollment process, and contact information above are the intended 2026 test-case instructions.</p>
        <div class="grid" style="margin-top:18px"><div><div style="border-bottom:1px solid #536577;padding-bottom:5px"><i>/s/ Avery Chen (synthetic)</i></div><p class="small muted">Authorized synthetic signature</p></div><div><div style="border-bottom:1px solid #536577;padding-bottom:5px">October 24, 2025</div><p class="small muted">Date</p></div></div>
      </div>
      <h2>Fixture notes</h2><p class="small">This form is a completed extraction fixture, not an insurance contract. Plan documents control benefit terms. The rate workbook controls premiums, contributions, and payroll deductions. All telephone numbers use reserved fictional ranges and all .test domains are non-production.</p>
      ${footer("NORTHSTAR FABRICATION · SYNTHETIC APPLICATION", 3, 3)}
    </section>`,
  ]);
}

type MedicalDesign = {
  name: string;
  hios: string;
  metal: string;
  deductible: string;
  oop: string;
  office: string;
  specialist: string;
  urgent: string;
  emergency: string;
  inpatient: string;
  outpatient: string;
  labs: string;
  imaging: string;
  rx: string;
  summary: string;
};

const medicalDesigns: MedicalDesign[] = [
  { name: "2026 SimplyBlue Plus Bronze 4", hios: "78124NY1000169-00", metal: "Bronze", deductible: "$8,500 individual / $17,000 family", oop: "$8,500 individual / $17,000 family", office: "100% after deductible; preventive care $0 before deductible", specialist: "100% after deductible", urgent: "100% after deductible", emergency: "100% after deductible", inpatient: "100% after deductible", outpatient: "100% after deductible", labs: "100% after deductible", imaging: "100% after deductible", rx: "Covered prescriptions: 100% after deductible", summary: "Highest deductible and lowest premium of the three options; the plan generally pays 100% after the deductible." },
  { name: "2026 SimplyBlue Plus Silver 19", hios: "78124NY1000297-00", metal: "Silver", deductible: "$3,600 individual / $7,200 family", oop: "$8,000 individual / $16,000 family", office: "$10 diagnostic / $25 other visit after deductible; preventive care $0 before deductible", specialist: "$50 copay after deductible", urgent: "$75 copay after deductible", emergency: "$350 copay after deductible", inpatient: "$500 per admission after deductible", outpatient: "$250 per facility visit after deductible", labs: "20% coinsurance after deductible", imaging: "$150 copay after deductible", rx: "$5 generic / $45 preferred brand / $90 non-preferred brand after deductible; specialty subject to formulary terms", summary: "Middle-premium option with defined copays after the deductible for many common services." },
  { name: "2026 SimplyBlue Plus Gold 6", hios: "78124NY1000025-00", metal: "Gold", deductible: "$2,000 individual / $4,000 family", oop: "$4,000 individual / $8,000 family", office: "20% coinsurance after deductible; preventive care $0 before deductible", specialist: "20% coinsurance after deductible", urgent: "20% coinsurance after deductible", emergency: "20% coinsurance after deductible", inpatient: "20% coinsurance after deductible", outpatient: "20% coinsurance after deductible", labs: "20% coinsurance after deductible", imaging: "20% coinsurance after deductible", rx: "$5 generic / $45 preferred brand / $90 non-preferred brand after deductible; specialty subject to formulary terms", summary: "Lowest deductible and out-of-pocket maximum of the three options, with 20% member coinsurance after the deductible for most services." },
];

function medicalPlanHtml(plan: MedicalDesign) {
  const rows = [
    ["Primary / preventive", plan.office], ["Specialist", plan.specialist], ["Urgent care", plan.urgent],
    ["Emergency room", plan.emergency], ["Inpatient hospital", plan.inpatient], ["Outpatient facility", plan.outpatient],
    ["Laboratory", plan.labs], ["Advanced imaging", plan.imaging], ["Prescription drugs", plan.rx],
  ].map(([service, cost]) => `<tr><td>${service}</td><td>${cost}</td><td>In-network; medical necessity and plan rules apply.</td></tr>`).join("");
  return documentHtml(plan.name, [
    `<section data-page-id="${plan.metal.toLowerCase()}-summary-1"><div class="eyebrow">Synthetic plan summary · medical</div><h1>${plan.name}</h1><div class="subhead">Excellus BlueCross BlueShield · SimplyBlue Plus PPO · HIOS ${plan.hios} · Coverage January 1–December 31, 2026</div><div class="synthetic">SYNTHETIC TEST FIXTURE. This summary is for Ansa pipeline testing and is not an insurance contract or carrier-issued SBC.</div>
      <div class="grid three"><div class="card tint"><h3>Metal level</h3><div class="metric">${plan.metal}</div></div><div class="card"><h3>Deductible</h3><p><b>${plan.deductible}</b></p></div><div class="card"><h3>Out-of-pocket maximum</h3><p><b>${plan.oop}</b></p></div></div>
      <h2>How the plan works</h2><p>${plan.summary}</p><p>The family deductible and out-of-pocket maximum apply to family coverage. Employee cost sharing accumulates toward the applicable out-of-pocket maximum. Premiums, non-covered services, balance bills, and penalties do not count unless the plan states otherwise.</p>
      <h2>Common in-network services</h2><table><thead><tr><th style="width:23%">Service</th><th style="width:42%">Member cost</th><th>Notes</th></tr></thead><tbody>${rows}</tbody></table>
      <div class="grid"><div class="card"><h3>Network and referrals</h3><p>Use participating SimplyBlue Plus providers for the highest level of coverage. Referrals are not required for participating specialists. Non-emergency out-of-network services are generally not covered unless authorized.</p></div><div class="card"><h3>HSA compatibility</h3><p>This medical design is identified as HSA-compatible. Northstar does not sponsor, administer, or fund a separate HSA benefit in this test case.</p></div></div>
      ${footer(`${plan.name} · SYNTHETIC PLAN SUMMARY`, 1, 2)}</section>`,
    `<section data-page-id="${plan.metal.toLowerCase()}-summary-2"><div class="eyebrow">Coverage terms</div><h1>${plan.name}</h1><div class="banner">Important limits, exclusions, and administration rules</div>
      <div class="grid"><div class="card"><h3>Prior authorization</h3><p>Prior authorization may be required for inpatient admissions, advanced imaging, certain outpatient procedures, specialty drugs, durable medical equipment, home health care, rehabilitation, and other services identified by the carrier. Failure to obtain required authorization may reduce or eliminate coverage.</p></div><div class="card"><h3>Prescription administration</h3><p>Formulary, utilization management, quantity limits, step therapy, prior authorization, and specialty-pharmacy requirements apply. A drug's tier and coverage can change during the year as permitted by law and plan terms.</p></div></div>
      <h2>Other covered services and common limitations</h2><table><thead><tr><th style="width:30%">Category</th><th>Plan treatment</th></tr></thead><tbody>
        <tr><td>Maternity and newborn care</td><td>Covered subject to the same applicable deductible, copay, and coinsurance rules as other medical services.</td></tr>
        <tr><td>Mental health and substance use</td><td>Covered in accordance with applicable parity requirements; site-of-care and authorization rules may apply.</td></tr>
        <tr><td>Rehabilitation and habilitation</td><td>Covered when medically necessary; visit and service limits may apply.</td></tr>
        <tr><td>Pediatric dental and vision</td><td>May be embedded as required under the medical policy; Northstar does not offer separate standalone vision coverage.</td></tr>
        <tr><td>Emergency services</td><td>Emergency care is covered without a referral. Emergency transport and balance-billing protections are governed by plan terms and applicable law.</td></tr>
      </tbody></table>
      <h2>Generally excluded or limited</h2><div class="grid"><div class="card"><ul><li>Cosmetic procedures unless medically necessary.</li><li>Experimental or investigational services.</li><li>Routine adult dental and routine adult vision care.</li><li>Services not medically necessary.</li><li>Non-emergency out-of-network care unless authorized.</li></ul></div><div class="card"><ul><li>Long-term custodial care.</li><li>Weight-loss programs and over-the-counter items unless specifically covered.</li><li>Care received after coverage terminates.</li><li>Charges above the plan's allowed amount when balance billing is permitted.</li><li>Services excluded by the controlling policy.</li></ul></div></div>
      <p class="small muted">For complete definitions, medical-necessity standards, exclusions, appeals, continuation rights, and claims rules, the carrier's controlling contract governs. Employees may contact Northstar HR at 208-555-0112 or benefits@northstar-fabrication.test for enrollment help.</p>
      ${footer(`${plan.name} · SYNTHETIC PLAN SUMMARY`, 2, 2)}</section>`,
  ]);
}

type DentalDesign = {
  slug: string;
  name: string;
  preventive: string;
  basic: string;
  major: string;
  networkDeductible: string;
  nonNetworkDeductible: string;
  annualMaximum: string;
};

const dentalDesigns: DentalDesign[] = [
  { slug: "basic", name: "2026 Delta Dental Basic Family PPO Plan I", preventive: "100%", basic: "60%", major: "Not covered for adults", networkDeductible: "$75 per adult / $225 family", nonNetworkDeductible: "$100 per adult / $300 family", annualMaximum: "$1,000 in-network / $750 out-of-network" },
  { slug: "enhanced", name: "2026 Delta Dental Enhanced Family PPO Plan III", preventive: "100%", basic: "80%", major: "50%", networkDeductible: "$25 per adult / $75 family", nonNetworkDeductible: "$50 per adult / $150 family", annualMaximum: "$1,000 in-network / $750 out-of-network" },
];

function dentalPlanHtml(plan: DentalDesign) {
  const basic = plan.slug === "basic";
  return documentHtml(plan.name, [
    `<section data-page-id="dental-${plan.slug}-1"><div class="eyebrow">Synthetic plan summary · dental</div><h1>${plan.name}</h1><div class="subhead">Delta Dental PPO · Coverage January 1–December 31, 2026</div><div class="synthetic">SYNTHETIC TEST FIXTURE. Benefit design is based on the selected option inventory and is not a carrier-issued certificate.</div>
      <div class="grid three"><div class="card tint"><h3>Preventive / diagnostic</h3><div class="metric">${plan.preventive}</div></div><div class="card"><h3>Basic restorative</h3><div class="metric">${plan.basic}</div></div><div class="card"><h3>Major services</h3><p><b>${plan.major}</b></p></div></div>
      <h2>Adult dental benefits</h2><table><thead><tr><th style="width:32%">Service category</th><th style="width:22%">Plan pays</th><th>Key terms</th></tr></thead><tbody>
        <tr><td>Exams, cleanings, routine X-rays</td><td>${plan.preventive}</td><td>Frequency limits apply; deductible waived for preventive and diagnostic care.</td></tr>
        <tr><td>Fillings and basic restorative</td><td>${plan.basic}</td><td>After the applicable deductible; alternate-benefit provisions may apply.</td></tr>
        <tr><td>Endodontics and periodontics</td><td>${basic ? "Not covered for adults" : "50%"}</td><td>${basic ? "See pediatric benefits for covered child services." : "After deductible; clinical and frequency limitations apply."}</td></tr>
        <tr><td>Crowns, bridges, dentures</td><td>${basic ? "Not covered for adults" : "50%"}</td><td>${basic ? "Adult major services are excluded under this option." : "After deductible; replacement-frequency and missing-tooth rules apply."}</td></tr>
        <tr><td>Oral surgery</td><td>${basic ? "Not covered for adults" : "50%"}</td><td>Medical-versus-dental coordination and authorization rules may apply.</td></tr>
        <tr><td>Adult orthodontia / implants</td><td>Not covered</td><td>No adult orthodontic or implant benefit under this option.</td></tr>
      </tbody></table>
      <div class="grid"><div class="card"><h3>In-network deductible</h3><p><b>${plan.networkDeductible}</b></p><h3>Non-network deductible</h3><p><b>${plan.nonNetworkDeductible}</b></p></div><div class="card tint"><h3>Adult annual maximum</h3><p><b>${plan.annualMaximum}</b></p><p>The annual maximum is the most the plan pays for covered adult services during the benefit year.</p></div></div>
      ${footer(`${plan.name} · SYNTHETIC PLAN SUMMARY`, 1, 2)}</section>`,
    `<section data-page-id="dental-${plan.slug}-2"><div class="eyebrow">Coverage terms</div><h1>${plan.name}</h1><div class="banner">Pediatric coverage, network rules, and limitations</div>
      <h2>Pediatric essential health benefits</h2><table><thead><tr><th style="width:32%">Category</th><th style="width:22%">Plan pays</th><th>Notes</th></tr></thead><tbody>
        <tr><td>Preventive and diagnostic</td><td>100%</td><td>Age and frequency limits apply.</td></tr>
        <tr><td>Basic restorative</td><td>${basic ? "60%" : "80%"}</td><td>After applicable deductible.</td></tr>
        <tr><td>Major services</td><td>50%</td><td>When medically necessary and covered under pediatric plan terms.</td></tr>
        <tr><td>Medically necessary orthodontia</td><td>50%</td><td>Prior authorization and medical-necessity criteria apply; cosmetic orthodontia is excluded.</td></tr>
      </tbody></table>
      <div class="grid"><div class="card"><h3>Using the PPO network</h3><p>Delta Dental PPO providers accept negotiated fees and file claims. Out-of-network care is reimbursed under the plan's non-network schedule; members may owe the difference between the dentist's charge and the allowed amount where permitted.</p><p>Predetermination is recommended for extensive or costly services but does not guarantee payment.</p></div><div class="card"><h3>Coordination and claims</h3><p>Coordination-of-benefits rules apply when a person has other dental coverage. Claims must be submitted within the policy's filing deadline. Benefits are based on the date a service is completed.</p></div></div>
      <h2>Common exclusions and limitations</h2><div class="grid"><div class="card"><ul><li>Services not dentally necessary.</li><li>Cosmetic procedures and supplies.</li><li>Adult orthodontia and implants.</li><li>Replacement of lost or stolen appliances.</li><li>Charges over the allowed amount.</li></ul></div><div class="card"><ul><li>Services before coverage starts or after it ends.</li><li>Duplicate, experimental, or investigational procedures.</li><li>Services covered under workers' compensation or similar law.</li><li>Frequency or replacement limits stated in the policy.</li><li>Missed-appointment and finance charges.</li></ul></div></div>
      <h2>Questions</h2><p>For enrollment and payroll questions, contact Northstar HR at 208-555-0112 or benefits@northstar-fabrication.test. For provider, claim, predetermination, and benefit-administration questions, use the carrier contact shown on the member ID card after enrollment.</p>
      <p class="small muted">The controlling dental policy governs if this summary differs from the contract. This fixture is deliberately limited to the benefit facts needed to test booklet generation.</p>
      ${footer(`${plan.name} · SYNTHETIC PLAN SUMMARY`, 2, 2)}</section>`,
  ]);
}

function formulaCell(formula: string, value: number, format = "$#,##0.00") {
  return { t: "n", f: formula, v: value, z: format } as XLSX.CellObject;
}

function costSheet(rows: RateRow[], title: string) {
  const data: unknown[][] = [
    [title],
    ["Plan", "Tier", "Monthly Premium", "ER Cost", "EE Cost", "EE Per Pay Period", "ER %", "# Enrolled", "ER Annual Total Cost", "EE Annual Total Cost", "Total Annual Plan Premiums"],
  ];
  rows.forEach((row, index) => {
    const excelRow = index + 3;
    const eeMonthly = employeeMonthly(row);
    const eePerPay = perPay(row);
    data.push([
      row.plan,
      row.tier,
      row.premium,
      row.employer,
      formulaCell(`MAX(0,C${excelRow}-D${excelRow})`, eeMonthly),
      formulaCell(`E${excelRow}*12/Assumptions!$B$5`, eePerPay),
      formulaCell(`IF(C${excelRow}=0,0,D${excelRow}/C${excelRow})`, row.employer / row.premium, "0.0%"),
      row.enrolled,
      formulaCell(`D${excelRow}*H${excelRow}*12`, row.employer * row.enrolled * 12),
      formulaCell(`E${excelRow}*H${excelRow}*12`, eeMonthly * row.enrolled * 12),
      formulaCell(`C${excelRow}*H${excelRow}*12`, row.premium * row.enrolled * 12),
    ]);
  });
  const totalRow = data.length + 1;
  data.push([
    "Grand Total", "", "", "", "", "", "",
    formulaCell(`SUM(H3:H${totalRow - 1})`, rows.reduce((sum, row) => sum + row.enrolled, 0), "0"),
    formulaCell(`SUM(I3:I${totalRow - 1})`, rows.reduce((sum, row) => sum + row.employer * row.enrolled * 12, 0)),
    formulaCell(`SUM(J3:J${totalRow - 1})`, rows.reduce((sum, row) => sum + employeeMonthly(row) * row.enrolled * 12, 0)),
    formulaCell(`SUM(K3:K${totalRow - 1})`, rows.reduce((sum, row) => sum + row.premium * row.enrolled * 12, 0)),
  ]);
  const sheet = XLSX.utils.aoa_to_sheet(data);
  sheet["!cols"] = [
    { wch: 42 }, { wch: 16 }, { wch: 16 }, { wch: 13 }, { wch: 13 }, { wch: 18 },
    { wch: 10 }, { wch: 12 }, { wch: 20 }, { wch: 20 }, { wch: 22 },
  ];
  sheet["!rows"] = [{ hpt: 24 }, { hpt: 28 }];
  sheet["!autofilter"] = { ref: `A2:K${totalRow - 1}` };
  for (let row = 3; row <= totalRow; row += 1) {
    for (const column of ["C", "D", "E", "F", "I", "J", "K"]) {
      const cell = sheet[`${column}${row}`];
      if (cell) cell.z = "$#,##0.00";
    }
    const percent = sheet[`G${row}`];
    if (percent) percent.z = "0.0%";
  }
  return sheet;
}

function createWorkbook() {
  const workbook = XLSX.utils.book_new();
  workbook.Props = {
    Title: "Northstar Fabrication 2026 Medical and Dental Rates and Contributions",
    Subject: "Synthetic cost and payroll deduction fixture",
    Author: "Ansa synthetic test fixture",
    Company: "Northstar Fabrication Test Company",
  };
  (workbook as XLSX.WorkBook & { CalcPr?: Record<string, unknown> }).CalcPr = {
    calcMode: "auto",
    fullCalcOnLoad: true,
    forceFullCalc: true,
  };
  const assumptions = XLSX.utils.aoa_to_sheet([
    ["Northstar Fabrication 2026 Rate Workbook — Synthetic Test Fixture"],
    ["Field", "Value", "Notes"],
    ["Plan year start", planYear.start, "Coverage effective date"],
    ["Plan year end", planYear.end, "Coverage termination date"],
    ["Payroll deductions per year", payPeriods, "Biweekly payroll"],
    ["Medical employer contribution", 75, "Flat monthly amount for every medical plan and tier"],
    ["Basic dental employer credit", 23, "50% of $46.00 employee-only premium; flat monthly credit for every tier"],
    ["Enhanced dental employer credit", 31.7, "50% of $63.40 employee-only premium; flat monthly credit for every tier"],
    ["Per-pay formula", "(Monthly premium − employer monthly contribution) × 12 ÷ 26", "Displayed deductions round to cents; formulas retain full precision"],
    ["Scope", "Medical and dental only", "No ancillary benefits or spending accounts are offered"],
    ["Data status", "Synthetic / not for enrollment", "All rates and enrollment counts are test data"],
  ]);
  assumptions["!cols"] = [{ wch: 35 }, { wch: 52 }, { wch: 78 }];
  XLSX.utils.book_append_sheet(workbook, assumptions, "Assumptions");
  XLSX.utils.book_append_sheet(workbook, costSheet(medicalRows, "Northstar Fabrication — 2026 Medical Costs — 26 Pay Periods"), "Medical - 26 Pay Periods");
  XLSX.utils.book_append_sheet(workbook, costSheet(dentalRows, "Northstar Fabrication — 2026 Dental Costs — 26 Pay Periods"), "Dental - 26 Pay Periods");

  const summaryRows = [
    ["Northstar Fabrication 2026 Annual Cost Summary"],
    ["Benefit", "Enrolled elections", "Employer annual cost", "Employee annual cost", "Total annual premiums"],
    [
      "Medical",
      formulaCell(`'Medical - 26 Pay Periods'!H${medicalRows.length + 3}`, medicalRows.reduce((sum, row) => sum + row.enrolled, 0), "0"),
      formulaCell(`'Medical - 26 Pay Periods'!I${medicalRows.length + 3}`, medicalRows.reduce((sum, row) => sum + row.employer * row.enrolled * 12, 0)),
      formulaCell(`'Medical - 26 Pay Periods'!J${medicalRows.length + 3}`, medicalRows.reduce((sum, row) => sum + employeeMonthly(row) * row.enrolled * 12, 0)),
      formulaCell(`'Medical - 26 Pay Periods'!K${medicalRows.length + 3}`, medicalRows.reduce((sum, row) => sum + row.premium * row.enrolled * 12, 0)),
    ],
    [
      "Dental",
      formulaCell(`'Dental - 26 Pay Periods'!H${dentalRows.length + 3}`, dentalRows.reduce((sum, row) => sum + row.enrolled, 0), "0"),
      formulaCell(`'Dental - 26 Pay Periods'!I${dentalRows.length + 3}`, dentalRows.reduce((sum, row) => sum + row.employer * row.enrolled * 12, 0)),
      formulaCell(`'Dental - 26 Pay Periods'!J${dentalRows.length + 3}`, dentalRows.reduce((sum, row) => sum + employeeMonthly(row) * row.enrolled * 12, 0)),
      formulaCell(`'Dental - 26 Pay Periods'!K${dentalRows.length + 3}`, dentalRows.reduce((sum, row) => sum + row.premium * row.enrolled * 12, 0)),
    ],
    [
      "Combined",
      formulaCell("SUM(B3:B4)", medicalRows.concat(dentalRows).reduce((sum, row) => sum + row.enrolled, 0), "0"),
      formulaCell("SUM(C3:C4)", medicalRows.concat(dentalRows).reduce((sum, row) => sum + row.employer * row.enrolled * 12, 0)),
      formulaCell("SUM(D3:D4)", medicalRows.concat(dentalRows).reduce((sum, row) => sum + employeeMonthly(row) * row.enrolled * 12, 0)),
      formulaCell("SUM(E3:E4)", medicalRows.concat(dentalRows).reduce((sum, row) => sum + row.premium * row.enrolled * 12, 0)),
    ],
  ];
  const summary = XLSX.utils.aoa_to_sheet(summaryRows);
  summary["!cols"] = [{ wch: 26 }, { wch: 20 }, { wch: 22 }, { wch: 22 }, { wch: 22 }];
  for (let row = 3; row <= 5; row += 1) for (const column of ["C", "D", "E"]) if (summary[`${column}${row}`]) summary[`${column}${row}`].z = "$#,##0.00";
  XLSX.utils.book_append_sheet(workbook, summary, "Annual Summary");
  return workbook;
}

async function writePdf(filePath: string, html: string) {
  const pdf = await generateBookletPdfFromHtml(html);
  await fs.writeFile(filePath, pdf);
  return pdf;
}

function loadedFile(filePath: string, data: Buffer): LoadedUploadedFile {
  const extension = path.extname(filePath).toLowerCase();
  const mimeType = extension === ".xlsx"
    ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    : "application/pdf";
  const textContent = extension === ".pdf"
    ? execFileSync("pdftotext", [filePath, "-"], { encoding: "utf8" })
    : undefined;
  return {
    id: createHash("sha1").update(path.relative(root, filePath)).digest("hex").slice(0, 20),
    companyId,
    fileName: path.basename(filePath),
    storagePath: path.relative(root, filePath),
    mimeType,
    uploadedAt: new Date().toISOString(),
    sha256: sha256(data),
    processingStatus: "complete",
    sourceKind: "file_upload",
    data,
    ...(textContent ? { textContent } : {}),
  };
}

async function main() {
  const localEnv = loadEnv("development", root, "");
  const productionEnv = loadEnv("production", path.join(root, ".vercel"), "");
  for (const [key, value] of Object.entries({ ...productionEnv, ...localEnv })) if (!process.env[key]) process.env[key] = value;
  process.env.BOOKLET_EXTRACTOR_DISABLE_REPAIR ||= "1";
  if (!process.env.OPENAI_API_KEY) throw new Error("OPENAI_API_KEY is required to run the real extraction pipeline");

  await Promise.all([employerDirectory, ratesDirectory, medicalDirectory, dentalDirectory, bookletDirectory].map((directory) => fs.mkdir(directory, { recursive: true })));

  const applicationPath = path.join(employerDirectory, "01_northstar-fabrication_2026_completed-employer-benefits-application_synthetic.pdf");
  const applicationPdf = await writePdf(applicationPath, applicationHtml());
  console.log(`Created ${path.relative(root, applicationPath)}`);

  const workbookPath = path.join(ratesDirectory, "02_northstar-fabrication_2026_medical-dental-rates-and-contributions_synthetic.xlsx");
  const workbookBuffer = Buffer.from(XLSX.write(createWorkbook(), { type: "buffer", bookType: "xlsx", compression: true, cellStyles: true }));
  await fs.writeFile(workbookPath, workbookBuffer);
  console.log(`Created ${path.relative(root, workbookPath)}`);

  const planFiles: Array<{ filePath: string; data: Buffer }> = [];
  for (const [index, plan] of medicalDesigns.entries()) {
    const filePath = path.join(medicalDirectory, `${index + 3}_northstar_2026_${plan.metal.toLowerCase()}_simplyblue-plus-plan-summary_synthetic.pdf`);
    const data = await writePdf(filePath, medicalPlanHtml(plan));
    planFiles.push({ filePath, data });
    console.log(`Created ${path.relative(root, filePath)}`);
  }
  for (const [index, plan] of dentalDesigns.entries()) {
    const filePath = path.join(dentalDirectory, `${index + 6}_northstar_2026_delta-dental-${plan.slug}-plan-summary_synthetic.pdf`);
    const data = await writePdf(filePath, dentalPlanHtml(plan));
    planFiles.push({ filePath, data });
    console.log(`Created ${path.relative(root, filePath)}`);
  }

  const files = [
    loadedFile(applicationPath, applicationPdf),
    loadedFile(workbookPath, workbookBuffer),
    ...planFiles.map(({ filePath, data }) => loadedFile(filePath, data)),
  ];
  const events: PipelineEvent[] = [];
  const result = await runBookletPipeline({
    runId: "northstar-medical-dental-2026-synthetic",
    companyId,
    files,
    enforceRegistry: false,
    answers: {
      "employer.name": "Northstar Fabrication",
      "offeredBenefits.hsa": false,
    },
    onEvent: async (event) => {
      events.push(event);
      if (event.status !== "progress") console.log(`[${event.status}] ${event.stage}: ${event.message}`);
    },
  });
  if (result.status !== "complete" || !result.pdf || !result.html) {
    const blockerPath = path.join(bookletDirectory, "pipeline-blockers.json");
    await fs.writeFile(blockerPath, JSON.stringify({ questions: result.questions, events }, null, 2));
    throw new Error(`Pipeline blocked; see ${path.relative(root, blockerPath)}`);
  }

  const bookletPath = path.join(bookletDirectory, "09_northstar-fabrication_2026_employee-benefits-booklet.pdf");
  const htmlPath = path.join(bookletDirectory, "09_northstar-fabrication_2026_employee-benefits-booklet.html");
  const auditPath = path.join(bookletDirectory, "09_northstar-fabrication_2026_pipeline-audit.json");
  await fs.writeFile(bookletPath, result.pdf);
  await fs.writeFile(htmlPath, result.html);
  await fs.writeFile(auditPath, JSON.stringify({
    generationMode: "employee_booklet",
    enforceRegistry: false,
    status: result.status,
    classifications: result.classifications,
    selectedPlans: result.benefitsPackage.plans.map((plan) => ({ name: plan.name, benefitType: plan.benefitType, carrier: plan.carrier, ratePlanId: plan.ratePlanId })),
    offeredBenefits: result.benefitsPackage.offeredBenefits.map((offering) => ({ benefitType: offering.benefitType, offered: offering.offered })),
    planYear: result.benefitsPackage.planYear,
    employer: result.benefitsPackage.employer,
    eligibility: result.benefitsPackage.eligibility,
    outline: result.outline,
    qualityReport: result.qualityReport,
    events,
  }, null, 2));

  const manifest = `# Northstar Fabrication 2026 synthetic booklet test package\n\nThis folder contains a complete, fictional input set and the booklet generated from it by Ansa's real \`employee_booklet\` pipeline. Nothing here is valid for enrollment or insurance administration.\n\n## Offered benefits\n\n- Medical: 2026 SimplyBlue Plus Bronze 4, Silver 19, and Gold 6\n- Dental: 2026 Delta Dental Basic Family PPO Plan I and Enhanced Family PPO Plan III\n- No other benefits or spending accounts are offered\n\n## Package contents\n\n- \`01_employer-setup/\`: completed synthetic employer application with plan year, eligibility, enrollment instructions, contacts, selections, and contribution rules\n- \`02_rates-and-contributions/\`: formula-driven Excel workbook containing premiums, employer costs, employee monthly costs, 26-pay-period deductions, enrollment counts, and annual totals\n- \`03_plan-documents/\`: five synthetic plan summaries with the material benefit terms used by the generator\n- \`04_generated-booklet/\`: final employee booklet, source HTML, and pipeline audit metadata\n\n## Calculation rules\n\nMedical receives a flat $75.00 monthly employer contribution for every plan and tier. Basic dental receives a flat $23.00 monthly credit and Enhanced dental receives $31.70, each equal to 50% of that option's employee-only premium. Per-pay deductions use \`(monthly premium − employer monthly contribution) × 12 ÷ 26\`.\n\n## Provenance\n\nThe selected Excellus plan names, IDs, design values, and base rates were aligned to the local 2026 Q1 Excellus rate inventory. Dental option names and benefit percentages were aligned to the local Delta Dental Basic Family PPO Plan I and Enhanced Family PPO Plan III source policies. Dental rates, employer contributions, enrollment counts, employer identity, and contacts are explicitly synthetic.\n`;
  await fs.writeFile(path.join(outputRoot, "README.md"), manifest);
  console.log(`Created ${path.relative(root, bookletPath)}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack : String(error));
  process.exitCode = 1;
});
