import chromium from "@sparticuz/chromium";
import { PDFDocument } from "pdf-lib";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import puppeteer from "puppeteer-core";

type Tier = {
  tier?: string;
  premium?: number;
  erPercent?: number;
  enrolled?: number;
};
type Plan = { name?: string; year?: number | string; tiers?: Tier[] };
type Benefit = { years?: Array<number | string>; plans?: Plan[] };
type Company = {
  name?: string;
  description?: string;
  website?: string;
  industry?: string;
  headquarters?: string;
  employeeCount?: number;
  phone?: string;
  email?: string;
  renewalLabel?: string;
  benefits?: Record<string, Benefit>;
  planDetails?: any;
};
type GuidePage = {
  id: string;
  title: string;
  html?: string;
  basePage?: number;
  text: string;
};

const BASE_TEMPLATE =
  "/Users/miles/Library/Caches/Spark Desktop/messagesData/1/207503/Big Tows Benefit Booklet.pdf";

const esc = (value: unknown) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
const money = (value: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  }).format(value || 0);
const date = (value?: string) =>
  value
    ? new Date(`${value}T12:00:00`).toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
      })
    : "Not set";
const pending = (value?: unknown) =>
  !value ||
  /placeholder|example\.com|555\)?[ -]?01|to be confirmed/i.test(
    String(value),
  );
const real = (value?: unknown) => !pending(value);
const plain = (value: unknown, fallback = "") =>
  real(value) ? String(value) : fallback;

function validateBookletCompany(company: Company) {
  const missing: string[] = [],
    requireValue = (label: string, value: any) => {
      if (value === undefined || value === null || value === "")
        missing.push(label);
    };
  requireValue("Company name", company?.name);
  requireValue("Company description", company?.description);
  requireValue("Company website", company?.website);
  requireValue("Employer cover name", company?.planDetails?.employer?.cover);
  requireValue("Plan year start", company?.planDetails?.planYear?.start);
  requireValue("Plan year end", company?.planDetails?.planYear?.end);
  if (!company?.benefits?.health?.plans?.length)
    missing.push("Medical plan rates");
  if (!company?.benefits?.dental?.plans?.length)
    missing.push("Dental plan rates");
  for (const [benefitKey, benefit] of Object.entries(company?.benefits || {})) {
    for (const [planIndex, plan] of (benefit.plans || []).entries()) {
      const prefix = `${benefitKey} plan ${planIndex + 1}`;
      requireValue(`${prefix} name`, plan.name);
      requireValue(`${prefix} year`, plan.year);
      if (!plan.tiers?.length) missing.push(`${prefix} rates`);
      for (const [tierIndex, tier] of (plan.tiers || []).entries()) {
        requireValue(`${prefix}, tier ${tierIndex + 1} name`, tier.tier);
        if (typeof tier.premium !== "number")
          missing.push(`${prefix}, ${tier.tier || "tier"} premium`);
        if (typeof tier.erPercent !== "number")
          missing.push(`${prefix}, ${tier.tier || "tier"} employer contribution`);
      }
    }
  }
  return [...new Set(missing)];
}
export { validateBookletCompany };

const pageCss = `<style>
@page{size:Letter;margin:0}*{box-sizing:border-box}body{margin:0;font-family:Arial,Helvetica,sans-serif;color:#1d1d1d;background:#fff;counter-reset:page}.page{width:8.5in;height:11in;position:relative;page-break-after:always;overflow:hidden;padding:.54in .62in .44in;counter-increment:page}.page:before{content:"";position:absolute;inset:.25in auto .25in .24in;width:.08in;background:#1b6e98}.page:after{content:"";position:absolute;right:.2in;bottom:.2in;width:2.05in;height:2.05in;border-right:7px solid #b9c2c9;border-bottom:7px solid #b9c2c9;opacity:.65}.cover{display:flex;flex-direction:column;align-items:center;text-align:center;padding-top:1.05in}.cover h2{font-size:22px;letter-spacing:.11em;margin:0 0 18px;text-transform:uppercase;color:#1d6f99}.cover h1{font-family:Georgia,serif;font-size:44px;line-height:1.05;margin:.18in 0;color:#333}.cover .plan-year{font-size:18px;margin:.4in 0 .15in;color:#333}.cover .employer{font-size:18px;color:#333}.brand{position:absolute;bottom:.46in;left:.7in;font-weight:700;color:#777}.title{color:#1d6f99;font-family:Georgia,serif;font-size:27px;letter-spacing:.04em;text-transform:uppercase;margin:0 0 .24in}.subhead{font-weight:700;color:#1d6f99;font-size:13px;text-transform:uppercase;margin:18px 0 8px}.lede{font-size:16px;line-height:1.45;max-width:4.6in;color:#333}.body-copy{font-size:12px;line-height:1.55;color:#333;max-width:6.6in}.toc{width:5.6in;margin:.25in auto 0;border-collapse:collapse;font-size:14px}.toc td{padding:7px 0}.toc td:last-child{text-align:right}.twocol{display:grid;grid-template-columns:1fr 1fr;gap:.22in}.box{border-top:4px solid #1d6f99;background:#f3f6f8;padding:13px;margin:10px 0}.box p,.box li{font-size:11px;line-height:1.45}.muted{color:#666}.plan-name{font-size:17px;font-weight:700;margin:0 0 .2in}.carrier{font-size:13px;color:#1d6f99;font-weight:700;margin:0 0 6px}.benefit-table,.cost-table,.contact-table{width:100%;border-collapse:collapse;font-size:10px;margin:8px 0 16px}.benefit-table th,.cost-table th,.contact-table th{background:#1d6f99;color:white;text-align:left;padding:7px}.benefit-table td,.cost-table td,.contact-table td{border-bottom:1px solid #cfd8df;padding:7px;vertical-align:top}.benefit-table tr:nth-child(even) td,.cost-table tr:nth-child(even) td{background:#f4f7f9}.cost-table .highlight{font-weight:700;color:#0d5c7f}.note{font-size:9px;line-height:1.4;color:#555;margin-top:12px}.small{font-size:9px}.footer{position:absolute;left:.62in;right:.62in;bottom:.28in;font-size:9px;color:#777;display:flex;justify-content:space-between}.legal{font-size:12px;line-height:1.7;max-width:6.4in}.page-number{font-size:10px;color:#777}.page-number:empty:after{content:counter(page)}.events{columns:2;column-gap:.35in;font-size:11px;line-height:1.55}.events li{break-inside:avoid;margin-bottom:4px}.welcome-lead{font-size:21px;line-height:1.35;width:4.1in;color:#222;margin-bottom:.4in}.welcome-body{width:4.95in;margin-left:1.7in}.right-rule{position:absolute;right:.55in;top:.55in;width:.05in;height:9.5in;background:#d9c87d}.date-row{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin:18px 0}.date-card{background:#1d6f99;color:white;padding:14px}.date-card small{display:block;text-transform:uppercase;letter-spacing:.08em;font-size:8px;margin-bottom:5px}.date-card b{font-size:12px}.comparison{font-size:9px}.comparison td,.comparison th{padding:6px}.pill{display:inline-block;background:#e7f1f5;color:#1d6f99;font-weight:700;padding:4px 8px;border-radius:2px;margin-bottom:8px}
.diff-cards{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin:8px 0 16px}.diff-card{border-left:5px solid #1d6f99;background:#f3f8fb;padding:10px}.diff-card small{display:block;text-transform:uppercase;color:#527283;font-size:8px;font-weight:700}.diff-card b{display:block;font-size:16px;margin:4px 0;color:#183746}.diff-card span{font-size:9px;color:#4d5c64}.diff-card.increase{border-color:#c06b2c;background:#fff4ec}.diff-card.employee{border-color:#168063;background:#edf8f3}.change-up{color:#9a4b16;font-weight:700}.change-down{color:#168063;font-weight:700}.change-flat{color:#59666d;font-weight:700}.current-cost{background:#eaf7f2!important;color:#12684f!important;font-weight:800}.cost-table tr.increase td{border-left:3px solid #d28a52}.cost-table tr.decrease td{border-left:3px solid #59a984}
</style>`;

const page = (
  id: string,
  title: string,
  body: string,
  text: string,
  extraClass = "",
): GuidePage => ({
  id,
  title,
  text,
  html: `<section class="page ${extraClass}">${body}</section>`,
});
const preserved = (basePage: number, title: string): GuidePage => ({
  id: `base-${basePage}`,
  title,
  basePage,
  text: title,
});

function footer(company: Company, n = "") {
  return `<div class="footer"><span>${esc(company.name || "Employee Benefits Guide")}</span><span class="${n ? "page-number" : ""}">${esc(n)}</span></div>`;
}

function tierRows(plan: Plan | undefined, payPeriods: number) {
  return (plan?.tiers || [])
    .map((tier) => {
      const premium = Number(tier.premium || 0),
        er = premium * Number(tier.erPercent || 0),
        ee = premium - er;
      return `<tr><td>${esc(tier.tier)}</td><td>${money(premium)}</td><td>${money(er)}</td><td>${money(ee)}</td><td>${money((er * 12) / payPeriods)}</td><td class="current-cost">${money((ee * 12) / payPeriods)}</td></tr>`;
    })
    .join("");
}

function planYear(company: Company) {
  const y = company.planDetails?.planYear;
  if (y?.start || y?.end) return `${date(y.start)} to ${date(y.end)}`;
  return company.renewalLabel || "Current plan year";
}

function companyName(company: Company) {
  return (
    company.planDetails?.employer?.cover ||
    company.planDetails?.employer?.legal ||
    company.name ||
    "Employee"
  );
}

function tocPage(items: Array<[string, number]>, company: Company) {
  let current = 3;
  const rows = items
    .map(([label, count]) => {
      const shown = count > 1 ? `${current}-${current + count - 1}` : current;
      current += count;
      return `<tr><td>${esc(label)}</td><td>${shown}</td></tr>`;
    })
    .join("");
  return page(
    "toc",
    "Table of contents",
    `<h1 class="title">Table of Contents</h1><table class="toc"><tbody>${rows}</tbody></table>${footer(company, "2")}`,
    items.map(([label]) => label).join(" "),
  );
}

function coverPage(company: Company) {
  return page(
    "cover",
    "Cover",
    `<h2>Employee</h2><h1>Benefits Guide</h1><div class="plan-year">${esc(planYear(company))}</div><div class="employer">${esc(companyName(company))}</div><div class="brand">Clarke</div>${footer(company, "1")}`,
    `${companyName(company)} ${planYear(company)}`,
    "cover",
  );
}

function welcomePage(company: Company) {
  const name = companyName(company);
  return page(
    "welcome",
    "Welcome",
    `<div class="right-rule"></div><h1 class="title">Welcome</h1><div class="welcome-lead">${esc(name)} goal is to provide you and your family with the most effective, cost-efficient and comprehensive benefits package.</div><div class="welcome-body body-copy"><p>These programs are reviewed annually to ensure they are in-line with the current trends and remain in compliance with government regulations such as Health Care Reform legislation. Each plan year, you will see a continued dedication to offering benefit choices so you can make the best decisions for yourself and your family.</p><p>This guide is designed to highlight your benefit options. It is not a complete Summary Plan Description. For more details including covered expenses, exclusions, and limitations, refer to individual Summary Plan Descriptions or request information directly from the insurance carrier. If any discrepancy exists between this guide and the official documents, the Summary Plan Description will prevail.</p></div>${footer(company, "3")}`,
    `Welcome ${name}`,
  );
}

function openEnrollmentPage(company: Company) {
  const e = company.planDetails?.enrollment || {};
  const whatsNew = (e.whatsNew || [])
    .filter(real)
    .map((x: string, i: number) => `<li>${i + 1}. ${esc(x)}</li>`)
    .join("");
  return page(
    "open-enrollment",
    "Open enrollment",
    `<h1 class="title">Open Enrollment</h1><h2 class="subhead">Open enrollment for the plan year</h2><p class="body-copy">Open Enrollment is the window of opportunity to review your benefit enrollments and determine if you want to make changes for the following plan year. Decisions made during Open Enrollment are generally binding for the entire plan year and cannot be changed until next year's Open Enrollment unless there is a qualified change in status.</p><div class="date-row"><div class="date-card"><small>Open enrollment dates</small><b>${esc(date(e.start))} - ${esc(date(e.end))}</b></div><div class="date-card"><small>Enrollment meeting</small><b>${esc(plain(e.meeting, "Meeting details to be announced"))}</b></div></div>${whatsNew ? `<h2 class="subhead">What's new</h2><ol class="body-copy">${whatsNew}</ol>` : ""}<h2 class="subhead">How to enroll</h2><p class="body-copy">Fill out all enrollment forms and return them to ${esc(plain(company.planDetails?.contacts?.enrollment?.name, "Human Resources"))}. If waiving coverages, sign the waiver and submit it by the enrollment deadline.</p>${footer(company, "4")}`,
    "Open enrollment",
  );
}

function eligibilityPage(company: Company) {
  const eligibility = company.planDetails?.eligibility || {};
  return page(
    "eligibility",
    "Eligibility",
    `<h1 class="title">Eligibility</h1><h2 class="subhead">Initial eligibility period</h2><p class="body-copy">${esc(eligibility.initialPeriod || "The initial eligibility period begins the day you become benefit eligible under your employer's eligibility guidelines and ends 30 days from that date. If your enrollment is not completed on or before the end of your initial eligibility period, you will have to wait until the next Open Enrollment period unless there is a qualifying event.")}</p><h2 class="subhead">Dependents</h2><p class="body-copy">You can enroll eligible dependents for medical and dental coverage. Eligible dependents generally include your spouse, domestic partner when permitted, naturally born children, legally adopted children, stepchildren, foster children, children for whom you have legal custody, and children covered under a Qualified Medical Child Support Order.</p><p class="body-copy">Eligible children are generally covered until the end of the month following their 26th birthday, unless the official plan documents provide otherwise.</p><div class="box"><h2 class="subhead">Qualified change in status</h2><p>Unless you experience a life-changing qualifying event, you cannot make changes until the next Open Enrollment period. Qualifying events include:</p><ul class="events"><li>Marriage, divorce or legal separation</li><li>Birth or adoption of a child</li><li>Change in child's dependent status</li><li>Death of a spouse, child or qualified dependent</li><li>Change in service area</li><li>Change in employment status or coverage under another employer-sponsored plan</li></ul><p>Requests must be received within 30 days of the event date. Late submissions are subject to carrier approval.</p></div>${footer(company, "5")}`,
    "Eligibility dependents qualified change in status",
  );
}

function medicalPages(company: Company, payPeriods: number) {
  const plans = company.benefits?.health?.plans || [],
    current = plans[plans.length - 1],
    carrier = plain(company.planDetails?.carriers?.medicalDental?.name, "");
  const pages: GuidePage[] = [];
  [current].filter(Boolean).forEach((plan, index) => {
    pages.push(
      page(
        `medical-${index + 1}`,
        `Medical ${plan!.year}`,
        `<h1 class="title">Medical Plan${index === 0 ? "" : " - Prior Year"}</h1><p class="carrier">${esc(carrier || "Medical carrier")}</p><p class="plan-name">${esc(plan!.name || "Medical plan")}</p><table class="cost-table"><thead><tr><th>Coverage tier</th><th>Total / mo.</th><th>ER / mo.</th><th>EE / mo.</th><th>ER / pay</th><th>EE / pay</th></tr></thead><tbody>${tierRows(plan, payPeriods)}</tbody></table><p class="note">ER = Employer. EE = Employee. Per-pay amounts use ${payPeriods} payroll deductions and are rounded to cents.</p><p class="note">This summary represents a general overview. Limitations and exclusions may vary depending on your specific benefit plan. Review carrier documents for complete information.</p>${footer(company)}`,
        `${plan!.name} ${plan!.year} medical ER EE cost per pay period`,
      ),
    );
  });
  return pages;
}

function dentalPage(company: Company, payPeriods: number) {
  const dentalPlans = company.benefits?.dental?.plans || [],
    plan = dentalPlans[dentalPlans.length - 1],
    carrier = plain(company.planDetails?.carriers?.medicalDental?.name, "");
  const currentEeTier = plan?.tiers?.[0],
    currentEePerPay =
      currentEeTier &&
      (Number(currentEeTier.premium || 0) *
        (1 - Number(currentEeTier.erPercent || 0)) *
        12) /
        payPeriods;
  const comparison =
    plan && typeof currentEePerPay === "number"
      ? `<div class="diff-cards"><div class="diff-card employee"><small>Employee-only EE / pay</small><b>${money(currentEePerPay)}</b><span>Current plan year</span></div><div class="diff-card"><small>Payroll basis</small><b>${payPeriods}</b><span>Deductions per year</span></div><div class="diff-card"><small>Costs shown</small><b>ER / EE</b><span>Employer and employee share</span></div></div>`
      : "";
  return page(
    "dental",
    "Dental",
    `<h1 class="title">Dental Plan</h1><p class="carrier">${esc(carrier || "Dental carrier")}</p><p class="plan-name">${esc(plan?.name || "Dental plan")}</p>${comparison}<table class="cost-table"><thead><tr><th>Coverage tier</th><th>Total / mo.</th><th>ER / mo.</th><th>EE / mo.</th><th>ER / pay</th><th>EE / pay</th></tr></thead><tbody>${tierRows(plan, payPeriods)}</tbody></table><p class="note">ER = Employer. EE = Employee. Per-pay amounts use ${payPeriods} payroll deductions and are rounded to cents.</p><p class="note">This summary represents a general overview. Limitations and exclusions may vary depending on your specific benefit plan. Review carrier documents for complete information.</p>${footer(company)}`,
    `${plan?.name || "Dental"} ER EE cost per pay period`,
  );
}

function telemedicinePage(company: Company) {
  const tele = company.planDetails?.telemedicine || {};
  return page(
    "telemedicine",
    "Telemedicine",
    `<h1 class="title">Telemedicine</h1><p class="carrier">${esc(plain(tele.app, "Virtual care resources"))}</p><p class="body-copy">Telemedicine can provide convenient non-emergency care when an in-person visit is not practical. It is not a replacement for your primary care physician or specialist.</p><h2 class="subhead">Common conditions treated</h2><div class="twocol body-copy"><ul><li>Acne</li><li>Allergies</li><li>Asthma</li><li>Bronchitis</li><li>Cold and flu</li></ul><ul><li>Earache</li><li>Fever</li><li>Nausea</li><li>Pinkeye</li><li>Sinus symptoms</li></ul></div><h2 class="subhead">Contact</h2><table class="contact-table"><tbody><tr><th>App</th><td>${esc(plain(tele.app, "Refer to your carrier resources"))}</td></tr><tr><th>Phone</th><td>${esc(plain(tele.phone, "Refer to your carrier ID card"))}</td></tr><tr><th>Text</th><td>${esc(plain(tele.text, "Not provided"))}</td></tr><tr><th>Website</th><td>${esc(plain(tele.website, company.website || "Not provided"))}</td></tr></tbody></table><p class="note">Availability, cost, prescriptions, behavioral health access, and covered services depend on the official plan documents.</p>${footer(company)}`,
    "Telemedicine virtual care",
  );
}

function hraPage(company: Company) {
  const accounts = company.planDetails?.accounts || {};
  const rows =
    (accounts.hraContributions || [])
      .map(
        (r: any) =>
          `<tr><td>${esc(r.tier)}</td><td>${money(Number(r.amount || 0))}</td></tr>`,
      )
      .join("") ||
    `<tr><td colspan="2">HRA contribution amounts have not been entered.</td></tr>`;
  return page(
    "hra",
    "Health reimbursement account",
    `<h1 class="title">Health Reimbursement Account</h1><p class="carrier">${esc(plain(accounts.administrator, "Account administrator pending"))}</p><p class="body-copy">An HRA is an employer-funded account that may reimburse eligible medical expenses such as copays, deductibles, and prescription drug costs when the plan allows it.</p><h2 class="subhead">Employer contribution</h2><table class="cost-table"><thead><tr><th>Coverage tier</th><th>Contribution</th></tr></thead><tbody>${rows}</tbody></table><p class="note">Use the official HRA plan documents and administrator materials for eligible expenses, claim rules, debit card rules, and runout deadlines.</p>${footer(company)}`,
    "Health reimbursement account HRA",
  );
}

function fsaPage(company: Company) {
  const accounts = company.planDetails?.accounts || {};
  return page(
    "fsa",
    "Flexible spending account",
    `<h1 class="title">Flexible Spending Account</h1><p class="carrier">${esc(plain(accounts.administrator, "Account administrator pending"))}</p><p class="body-copy">An FSA lets employees set aside pre-tax payroll deductions for eligible health care and dependent care expenses. Elections and reimbursements are governed by IRS rules and the official plan documents.</p><div class="twocol"><div class="box"><h2 class="subhead">Medical FSA</h2><p>May cover eligible medical, dental, vision, and prescription expenses. Save itemized receipts for card transactions and reimbursements.</p></div><div class="box"><h2 class="subhead">Dependent care FSA</h2><p>May cover eligible day care, after-school care, and other qualified dependent care expenses that allow you and your spouse, if applicable, to work.</p></div></div><p class="note">Confirm current annual IRS limits, carryover, grace period, and eligible expense rules before electing an amount.</p>${footer(company)}`,
    "Flexible spending account FSA",
  );
}

function visionPage(company: Company, payPeriods: number) {
  const visionPlans = company.benefits?.vision?.plans || [],
    plan = visionPlans[visionPlans.length - 1],
    carrier = plain(company.planDetails?.carriers?.vision?.name, "");
  return page(
    "vision",
    "Vision",
    `<h1 class="title">Vision Plan</h1><p class="carrier">${esc(carrier || "Vision carrier")}</p><p class="plan-name">${esc(plan?.name || "Vision plan")}</p>${plan ? `<table class="cost-table"><thead><tr><th>Coverage tier</th><th>Total / mo.</th><th>ER / mo.</th><th>EE / mo.</th><th>ER / pay</th><th>EE / pay</th></tr></thead><tbody>${tierRows(plan, payPeriods)}</tbody></table>` : `<div class="box"><p>Vision rates and plan details have not been entered in the application.</p></div>`}<p class="note">Refer to the official vision certificate for exams, lenses, frames, contacts, network rules, reimbursements, and exclusions.</p>${footer(company)}`,
    "Vision plan",
  );
}

function lifePage(company: Company) {
  const coverage = company.planDetails?.coverageDetails?.life || {},
    carrier = plain(company.planDetails?.carriers?.lifeLtd?.name, "");
  return page(
    "life",
    "Basic life and AD&D",
    `<h1 class="title">Life & AD&D</h1><p class="carrier">${esc(carrier || "Life and AD&D carrier")}</p><table class="benefit-table"><tbody><tr><th>Life benefit</th><td>${esc(plain(coverage.benefit, "Benefit amount pending confirmation"))}</td></tr><tr><th>AD&D benefit</th><td>${esc(plain(coverage.addBenefit, "Benefit amount pending confirmation"))}</td></tr><tr><th>Who pays</th><td>${esc(plain(coverage.funding, "Funding pending confirmation"))}</td></tr><tr><th>Employee cost</th><td>${esc(plain(coverage.employeeCost, "Cost pending confirmation"))}</td></tr><tr><th>Guarantee issue</th><td>${esc(plain(coverage.guaranteeIssue, "Pending confirmation"))}</td></tr><tr><th>Age reduction</th><td>${esc(plain(coverage.ageReduction, "Pending confirmation"))}</td></tr></tbody></table><p class="note">Name and review your beneficiary during enrollment. Eligibility, exclusions, reductions, and payment of a claim are governed by the official policy.</p>${footer(company)}`,
    "Life AD&D",
  );
}

function ltdPage(company: Company) {
  const coverage = company.planDetails?.coverageDetails?.longTermDisability || {},
    carrier = plain(company.planDetails?.carriers?.lifeLtd?.name, "");
  return page(
    "ltd",
    "Long term disability",
    `<h1 class="title">Long Term Disability</h1><p class="carrier">${esc(carrier || "Long term disability carrier")}</p><p class="body-copy">Long term disability coverage may replace part of income when a covered illness or injury prevents an eligible employee from working for an extended period.</p><table class="benefit-table"><tbody><tr><th>Benefit percentage</th><td>${esc(plain(coverage.benefitPercentage, "Pending confirmation"))}</td></tr><tr><th>Monthly maximum</th><td>${esc(plain(coverage.monthlyMaximum, "Pending confirmation"))}</td></tr><tr><th>Elimination period</th><td>${esc(plain(coverage.eliminationPeriod, "Pending confirmation"))}</td></tr><tr><th>Maximum duration</th><td>${esc(plain(coverage.maximumDuration, "Pending confirmation"))}</td></tr><tr><th>Pre-existing conditions</th><td>${esc(plain(coverage.preExistingConditions, "Pending confirmation"))}</td></tr><tr><th>Who pays</th><td>${esc(plain(coverage.funding, "Funding pending confirmation"))}</td></tr></tbody></table><p class="note">Benefit approval depends on the policy definition of disability, medical documentation, and all policy terms.</p>${footer(company)}`,
    "Long term disability",
  );
}

function eapPage(company: Company) {
  const eap = company.planDetails?.carriers?.eap || {};
  return page(
    "eap",
    "Employee assistance program",
    `<h1 class="title">Employee Assistance Program</h1><p class="carrier">${esc(plain(eap.name, "Employee assistance program"))}</p><p class="body-copy">The EAP provides voluntary, confidential support for employees and eligible dependents. Access, visit limits, and covered services depend on the official program materials.</p><h2 class="subhead">Common support areas</h2><div class="twocol body-copy"><ul><li>Stress</li><li>Depression</li><li>Grief and loss</li><li>Family or marital issues</li><li>Addiction concerns</li></ul><ul><li>Financial concerns</li><li>Legal resources</li><li>Child care resources</li><li>Elder care resources</li><li>Work-life support</li></ul></div><h2 class="subhead">Contact</h2><table class="contact-table"><tbody><tr><th>Phone</th><td>${esc(plain(eap.phone, "Refer to Human Resources"))}</td></tr><tr><th>Website</th><td>${esc(plain(eap.website, "Not provided"))}</td></tr></tbody></table>${footer(company)}`,
    "Employee assistance program EAP",
  );
}

function voluntaryPage(company: Company) {
  const voluntary = company.planDetails?.contacts?.voluntary || {};
  return page(
    "voluntary",
    "Voluntary benefits",
    `<h1 class="title">Voluntary Benefits</h1><p class="body-copy">Voluntary benefits may provide additional protection for accidents, specified diseases, hospital stays, life events, or disability. Available options vary based on employer offering and carrier availability.</p><div class="box"><h2 class="subhead">Available options may include</h2><ul><li>Accident insurance</li><li>Critical illness or specified disease coverage</li><li>Hospital indemnity</li><li>Voluntary life insurance</li><li>Short-term disability</li></ul></div><h2 class="subhead">Representative</h2><table class="contact-table"><tbody><tr><th>Name</th><td>${esc(plain(voluntary.name, "Not provided"))}</td></tr><tr><th>Phone</th><td>${esc(plain(voluntary.phone, "Not provided"))}</td></tr><tr><th>Email</th><td>${esc(plain(voluntary.email, "Not provided"))}</td></tr></tbody></table>${footer(company)}`,
    "Voluntary benefits",
  );
}

function contactsPage(company: Company) {
  const d = company.planDetails || {},
    contacts = [d.contacts?.hr, d.contacts?.enrollment, d.contacts?.voluntary]
      .filter((c: any) => c?.offered !== false)
      .filter((c: any) => [c?.name, c?.phone, c?.email].some(real)),
    carriers = Object.values(d.carriers || {}).filter((c: any) =>
      [c?.name, c?.phone, c?.website].some(real),
    );
  const contactRows =
      contacts
        .map(
          (c: any) =>
            `<tr><td>${esc(c.name)}</td><td>${esc(c.phone)}</td><td>${esc(c.email)}</td></tr>`,
        )
        .join("") ||
      `<tr><td>Human Resources</td><td>${esc(company.phone || "")}</td><td>${esc(company.email || "")}</td></tr>`,
    carrierRows =
      carriers
        .map(
          (c: any) =>
            `<tr><td>${esc(c.name)}</td><td>${esc(c.phone)}</td><td>${esc(c.website)}</td></tr>`,
        )
        .join("") ||
      `<tr><td>Carrier information</td><td colspan="2">Refer to your carrier ID card and official plan documents.</td></tr>`;
  return page(
    "contacts",
    "Contact list",
    `<h1 class="title">Employee Contact List</h1><h2 class="subhead">Carriers</h2><table class="contact-table"><thead><tr><th>Carrier</th><th>Phone</th><th>Website</th></tr></thead><tbody>${carrierRows}</tbody></table><h2 class="subhead">Human resources and enrollment</h2><table class="contact-table"><thead><tr><th>Contact</th><th>Phone</th><th>Email</th></tr></thead><tbody>${contactRows}</tbody></table><h2 class="subhead">Company</h2><p class="body-copy">${esc(companyName(company))}<br>${esc(company.website || "")}<br>${esc(company.phone || "")}</p>${footer(company)}`,
    "Contact list carriers human resources enrollment",
  );
}

function legalPage(company: Company) {
  return page(
    "legal",
    "Legal disclaimer",
    `<p class="legal">The information in this guide is presented for illustrative purposes and is based on information provided by the employer. The text contained in this guide was taken from various summary plan descriptions and benefit summaries. While every effort was taken to accurately summarize your benefits, discrepancies or errors are always possible. In case of a discrepancy between this guide and the actual plan documents, the actual plan documents will prevail.</p><p class="legal">All information is confidential pursuant to the Health Insurance Portability and Accountability Act of 1996. If you have questions about this summary, contact Human Resources or the applicable insurance carrier.</p><p class="legal">${esc(companyName(company))}<br>${esc(company.website || "")}</p>${footer(company)}`,
    "Legal disclaimer",
  );
}

function buildPages(company: Company, payPeriods: number): GuidePage[] {
  const medical = medicalPages(company, payPeriods);
  return [
    preserved(1, "Original Big Tows cover"),
    preserved(2, "Original Big Tows welcome"),
    preserved(3, "Original Big Tows eligibility"),
    ...medical,
    preserved(4, "Original Big Tows medical SBC"),
    preserved(5, "Original Big Tows medical SBC"),
    preserved(6, "Original Big Tows medical SBC"),
    preserved(7, "Original Big Tows medical SBC"),
    preserved(8, "Original Big Tows medical SBC"),
    preserved(9, "Original Big Tows medical SBC"),
    preserved(10, "Original Big Tows medical examples"),
    dentalPage(company, payPeriods),
    preserved(11, "Original Big Tows dental plan"),
    preserved(12, "Original Big Tows dental limitations"),
    preserved(13, "Original Big Tows dental exclusions"),
    contactsPage(company),
    legalPage(company),
  ];
}

export function renderBookletHtml(company: Company, payPeriods = 52) {
  const pages = buildPages(company, payPeriods).filter((p) => p.html);
  return `<!doctype html><html><head><meta charset="utf-8">${pageCss}</head><body>${pages
    .map((p) => p.html)
    .join("")}</body></html>`;
}

export function renderBookletPreviewPages(company: Company, payPeriods = 52) {
  const pages = buildPages(company, payPeriods);
  return pages.map((p, index) => ({
    index,
    title: p.title,
    text: p.text,
    html: p.html
      ? `<!doctype html><html><head><meta charset="utf-8">${pageCss}</head><body>${p.html}</body></html>`
      : "",
  }));
}

async function renderGeneratedPdf(company: Company, payPeriods: number) {
  const localChrome =
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
  const isLocal = existsSync(localChrome);
  const browser = await puppeteer.launch({
    args: isLocal ? ["--no-sandbox"] : chromium.args,
    defaultViewport: { width: 816, height: 1056 },
    executablePath: isLocal ? localChrome : await chromium.executablePath(),
    headless: true,
  });
  try {
    const pageInstance = await browser.newPage();
    await pageInstance.setContent(renderBookletHtml(company, payPeriods), {
      waitUntil: "load",
    });
    return Buffer.from(
      await pageInstance.pdf({
        format: "letter",
        printBackground: true,
        preferCSSPageSize: true,
        margin: { top: 0, right: 0, bottom: 0, left: 0 },
      }),
    );
  } finally {
    await browser.close();
  }
}

export async function generateBookletPdf(company: Company, payPeriods = 52) {
  if (!company || !company.name) throw new Error("Company data is required");
  const pages = buildPages(company, payPeriods);
  const generatedPdf = await PDFDocument.load(
    await renderGeneratedPdf(company, payPeriods),
  );
  const basePdf = await PDFDocument.load(await readFile(BASE_TEMPLATE));
  const output = await PDFDocument.create();
  let generatedIndex = 0;
  for (const item of pages) {
    const source = item.basePage ? basePdf : generatedPdf;
    const index = item.basePage ? item.basePage - 1 : generatedIndex++;
    const [copied] = await output.copyPages(source, [index]);
    output.addPage(copied);
  }
  return Buffer.from(await output.save());
}
