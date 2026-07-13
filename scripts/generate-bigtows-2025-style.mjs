import fs from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import puppeteer from "puppeteer-core";

const DATA_PATH = "tmp/pdfs/big-tows-firestore.json";
const OUT_PATH = "output/pdf/big-tows-2025-style-benefits-guide.pdf";
const PAY_PERIODS = 52;
const ASSET_PATHS = {
  cover: "public/pdf-assets/2025-benefit-guide-cover.png",
  welcome: "public/pdf-assets/2025-benefit-guide-welcome.png",
  legal: "public/pdf-assets/2025-benefit-guide-legal.png",
};

function decode(value) {
  if (value == null) return null;
  if ("stringValue" in value) return value.stringValue;
  if ("integerValue" in value) return Number(value.integerValue);
  if ("doubleValue" in value) return Number(value.doubleValue);
  if ("booleanValue" in value) return value.booleanValue;
  if (value.mapValue) {
    return Object.fromEntries(
      Object.entries(value.mapValue.fields || {}).map(([key, item]) => [
        key,
        decode(item),
      ]),
    );
  }
  if (value.arrayValue) return (value.arrayValue.values || []).map(decode);
  return null;
}

const esc = (value) =>
  String(value ?? "").replace(/[&<>"']/g, (c) => {
    return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[
      c
    ];
  });

const money = (value) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  }).format(Number(value || 0));

const prettyDate = (value) =>
  value
    ? new Date(`${value}T12:00:00`).toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
      })
    : "";

function costs(plan, payPeriods = PAY_PERIODS) {
  return (plan?.tiers || []).map((tier) => {
    const total = Number(tier.premium || 0);
    const erMonthly = total * Number(tier.erPercent || 0);
    const eeMonthly = total - erMonthly;
    return {
      tier: tier.tier,
      total,
      erMonthly,
      eeMonthly,
      erPay: (erMonthly * 12) / payPeriods,
      eePay: (eeMonthly * 12) / payPeriods,
    };
  });
}

function costRows(plan, payPeriods = PAY_PERIODS) {
  return costs(plan, payPeriods)
    .map(
      (r) => `<tr>
        <td>${esc(r.tier)}</td>
        <td>${money(r.total)}</td>
        <td>${money(r.erMonthly)}</td>
        <td>${money(r.eeMonthly)}</td>
        <td>${money(r.erPay)}</td>
        <td>${money(r.eePay)}</td>
      </tr>`,
    )
    .join("");
}

function page(title, subtitle, body, pageNo, cls = "") {
  return `<section class="page ${cls}">
    <div class="side-mark"></div>
    <div class="geo geo-left"></div>
    <div class="geo geo-right"></div>
    ${
      title
        ? `<header class="title-box"><h1>${title}</h1></header>${
            subtitle ? `<div class="subtitle">${subtitle}</div>` : ""
          }`
        : ""
    }
    <main>${body}</main>
    <footer><span>Clarke</span><span>${pageNo}</span></footer>
  </section>`;
}

const findAsset = (assetPath) => {
  const candidates = [
    assetPath,
    path.join(process.cwd(), assetPath),
    path.join(process.env.LAMBDA_TASK_ROOT || "", assetPath),
    path.join(path.dirname(new URL(import.meta.url).pathname), "..", assetPath),
  ].filter(Boolean);
  const found = candidates.find((candidate) => existsSync(candidate));
  if (!found) return assetPath;
  return found;
};

const imageData = async (assetPath) => {
  const data = await fs.readFile(findAsset(assetPath));
  return `data:image/png;base64,${data.toString("base64")}`;
};

async function buildBooklet(company, payPeriods = PAY_PERIODS, options = {}) {
const year = `${prettyDate(company.planDetails?.planYear?.start)} - ${prettyDate(
  company.planDetails?.planYear?.end,
)}`;
const healthPlans = company.benefits?.health?.plans || [];
const dentalPlans = company.benefits?.dental?.plans || [];
const health = healthPlans[healthPlans.length - 1];
const dental = dentalPlans[dentalPlans.length - 1];
const employer = company.planDetails?.employer?.cover || company.name;
const sourceArtwork = Boolean(options.sourceArtwork);
const coverImage = sourceArtwork
  ? await imageData(ASSET_PATHS.cover)
  : "";
const welcomeImage = sourceArtwork
  ? await imageData(ASSET_PATHS.welcome)
  : "";
const legalImage = sourceArtwork
  ? await imageData(ASSET_PATHS.legal)
  : "";
const css = `<style>
@page{size:Letter;margin:0}
*{box-sizing:border-box}
body{margin:0;font-family:Arial,Helvetica,sans-serif;color:#111;background:#fff}
.page{width:8.5in;height:11in;position:relative;overflow:hidden;page-break-after:always;padding:.62in .64in .5in;background:#fff}
.page main{position:relative;z-index:2}
.geo{position:absolute;top:0;bottom:0;width:1.45in;z-index:0;opacity:.68;background:linear-gradient(135deg,rgba(210,225,235,.72),rgba(242,246,249,.12) 56%,rgba(196,214,226,.5))}
.geo-left{left:0;clip-path:polygon(0 0,70% 0,32% 100%,0 100%)}
.geo-right{right:0;clip-path:polygon(58% 0,100% 0,100% 100%,8% 100%)}
.side-mark{position:absolute;left:.17in;top:.76in;width:.08in;height:.48in;background:#005c9f;z-index:3}
.title-box{position:relative;z-index:2;background:#005c9f;color:white;border:2px solid #c5d8e7;outline:2px solid #005c9f;width:3.08in;margin:0 auto .02in;padding:.08in .18in;text-align:center}
.title-box:after{content:"";position:absolute;left:.18in;right:.18in;bottom:-.13in;height:.12in;background:#fbefc7;z-index:-1}
.title-box h1{margin:0;font-family:Georgia,'Times New Roman',serif;font-size:16px;line-height:1.04;letter-spacing:.08em;text-transform:uppercase;font-variant:small-caps}
.subtitle{text-align:center;font-size:9px;margin:.12in 0 .24in}
h2{font-size:10px;color:#005c9f;text-transform:uppercase;margin:.18in 0 .08in}
p,li{font-size:9.2px;line-height:1.42}
.lead{font-size:14px;line-height:1.35;font-weight:700;color:white}
.copy{max-width:6.9in}
table{border-collapse:collapse;width:100%;font-size:8.2px;line-height:1.2;margin:.08in 0 .16in}
th{background:#18245a;color:#fff;text-align:left;font-weight:700}
th,td{padding:5px 6px;border:1px solid #d7dfec;vertical-align:top}
tbody tr:nth-child(odd) td{background:#eef3fb}
tbody tr:nth-child(even) td{background:#dfe8f6}
.teal th,.teal .band{background:#009e9a}
.band td{background:#005c9f!important;color:white;font-weight:700;text-transform:uppercase}
.note{font-size:7.8px;color:#333;text-align:center;border:1px solid #8fb9d9;background:#f4fbff;padding:5px;margin-top:.18in}
footer{position:absolute;left:.32in;right:.32in;bottom:.2in;display:flex;align-items:center;justify-content:space-between;z-index:3;color:#006c3b;font-size:8px}
footer span:last-child{background:#005c9f;color:#fff;min-width:.25in;text-align:center;padding:5px 6px}
${sourceArtwork ? `.cover{padding:0;background:#ddd url("${coverImage}") center/cover no-repeat}
.cover:before{content:"";position:absolute;inset:0;background:rgba(255,255,255,.03);z-index:0}
.cover:after{content:"";position:absolute;left:.34in;right:.34in;bottom:.42in;height:3.15in;background:linear-gradient(180deg,rgba(255,255,255,0),rgba(232,219,169,.08));z-index:1}
.cover-card{position:absolute;top:.18in;left:.78in;right:.78in;min-height:3.12in;background:#005c9f;color:#fff;border:2px solid #b9d2e4;outline:2px solid #005c9f;text-align:center;padding:.38in .2in;z-index:4}` : `.cover{padding:0;background:linear-gradient(180deg,#f6f8fa 0%,#edf3f6 45%,#efe6c8 100%)}
.cover:before{content:"";position:absolute;left:.34in;right:.34in;top:.32in;bottom:.42in;background:linear-gradient(115deg,rgba(206,221,231,.72),rgba(255,255,255,.42) 36%,rgba(219,231,237,.72) 37%,rgba(255,255,255,.34) 64%,rgba(209,224,232,.62) 65%);z-index:0}
.cover:after{content:"";position:absolute;left:.34in;right:.34in;bottom:.42in;height:3.15in;background:linear-gradient(180deg,rgba(255,255,255,0),rgba(232,219,169,.62));z-index:1}
.cover-card{position:absolute;top:.18in;left:.78in;right:.78in;min-height:2.24in;background:#005c9f;color:#fff;border:2px solid #b9d2e4;outline:2px solid #005c9f;text-align:center;padding:.32in .2in;z-index:4}`}
.cover-card h1{font-family:Georgia,'Times New Roman',serif;letter-spacing:.08em;text-transform:uppercase;font-size:24px;line-height:1.05;margin:0 0 .08in}
.cover-card p{font-size:11px;margin:.04in 0;color:#fff}
.cover-scrub{position:absolute;left:1.15in;right:1.15in;bottom:1.55in;height:1.62in;background:#fff;z-index:3;display:flex;align-items:center;justify-content:center;border:1px solid #e5edf2}
.cover-name{position:absolute;left:2.3in;right:2.3in;bottom:.06in;height:.72in;text-align:center;background:#005c9f;color:white;padding:.22in .12in;font-weight:700;z-index:4;font-size:11px}
.toc-table{width:5.6in;margin:.1in auto 0;font-size:9.5px}
.toc-table td{padding:5px 7px}
.logo-word{font-weight:800;color:#f58220;text-transform:uppercase;letter-spacing:.04em;font-size:24px;text-shadow:0 1px 0 #fff}
${sourceArtwork ? `.welcome{background:#fff url("${welcomeImage}") center/cover no-repeat}
.welcome:before{content:"";position:absolute;left:.55in;top:.4in;width:4.9in;height:9.35in;background:#005c9f;z-index:1}
.welcome:after{content:"";position:absolute;right:.68in;top:.62in;width:2.1in;height:8.9in;background:transparent;z-index:1}` : `.welcome{background:#fff}
.welcome:before{content:"";position:absolute;right:.68in;top:.62in;width:2.1in;height:8.9in;background:linear-gradient(180deg,#f7fbf7,#dfeada 45%,#f5e9ba);border-left:10px solid #fbefc7;z-index:1}
.welcome:after{content:"";position:absolute;right:1.15in;top:3.2in;width:1.18in;height:1.18in;border:1px solid #c9d8ce;background:#fff;box-shadow:0 .14in .28in rgba(0,0,0,.12);z-index:2}`}
.welcome .panel{position:absolute;left:.62in;top:.45in;width:4.7in;height:9.25in;background:#005c9f;color:white;padding:.54in .42in;z-index:2}
.welcome main{position:static}
.welcome h1{font-family:Georgia,'Times New Roman',serif;font-size:22px;letter-spacing:.04em;font-variant:small-caps;margin:0 0 .35in;color:#fff}
.welcome p{color:white}
.two{display:grid;grid-template-columns:1fr 1fr;gap:.22in}
.callout{background:#f0f3f7;padding:.13in;border-left:5px solid #005c9f;margin:.1in 0}
.cost-table th:nth-child(n+2),.cost-table td:nth-child(n+2){text-align:right}
.mini-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:.12in;margin:.08in 0 .14in}
.mini{background:#eef3fb;border-top:5px solid #005c9f;padding:.1in;min-height:.68in}
.mini b{display:block;color:#005c9f;font-size:10px;margin-bottom:2px}
.mini span{font-size:8px;line-height:1.25}
${sourceArtwork ? `.legal{background:#fff url("${legalImage}") center/cover no-repeat}
.legal:before{content:"";position:absolute;left:0;right:0;top:0;height:2.7in;background:#dce9ef;z-index:0}
.legal-box{position:absolute;left:1.36in;right:1.36in;top:3.25in;background:rgba(255,255,255,.84);padding:.22in;text-align:center;z-index:4}` : `.legal{background:linear-gradient(180deg,#e9f1f6,#fff 24%,#efe4c3 100%)}
.legal:before{content:"";position:absolute;left:.34in;right:.34in;top:.34in;bottom:.34in;background:linear-gradient(115deg,rgba(206,221,231,.74),rgba(255,255,255,.28) 36%,rgba(221,233,239,.7) 37%,rgba(255,255,255,.34) 64%,rgba(209,224,232,.62) 65%);z-index:0}
.legal-box{position:absolute;left:1.36in;right:1.36in;top:3.25in;background:rgba(255,255,255,.86);padding:.22in;text-align:center;z-index:4}`}
.legal-box p{font-size:9px;font-weight:700}
</style>`;

const pages = [
  `<section class="page cover">
    <div class="cover-card">
      <h1>Employee<br>Benefits Guide</h1>
      <p>${esc(year)}</p>
      <p>${esc(employer)}</p>
      <div class="logo-word">Big Tows</div>
    </div>
    <div class="cover-scrub"><div class="logo-word">Big Tows</div></div>
    <div class="cover-name">Clarke</div>
    <footer><span></span><span>1</span></footer>
  </section>`,
  page(
    "Table of Contents",
    "",
    `<table class="toc-table">
      <tbody>
        <tr><td>Welcome</td><td>3</td></tr>
        <tr><td>Eligibility</td><td>4</td></tr>
        <tr><td>Medical Plan</td><td>5</td></tr>
        <tr><td>Medical Cost Per Pay Period</td><td>6</td></tr>
        <tr><td>Dental Plan</td><td>7</td></tr>
        <tr><td>Dental Cost Per Pay Period</td><td>8</td></tr>
        <tr><td>Employee Contact List</td><td>9</td></tr>
      </tbody>
    </table>
    <div style="text-align:center;margin-top:1.3in">
      <div class="logo-word">Big Tows</div>
      <p>${esc(company.description)}</p>
    </div>`,
    2,
  ),
  `<section class="page welcome">
    <main><div class="panel">
      <h1>Welcome</h1>
      <p class="lead">${esc(employer)} goal is to provide you and your family with the most effective, cost-efficient and comprehensive benefits package.</p>
      <p>These programs are reviewed annually to ensure they remain current, cost conscious, and compliant. Please read this guide carefully so you can make informed enrollment decisions for yourself and your family.</p>
      <p>This guide highlights your benefit options. It is not a complete Summary Plan Description. If any discrepancy exists between this guide and the official documents, the Summary Plan Description will prevail.</p>
    </div></main>
    <footer><span>Clarke</span><span>3</span></footer>
  </section>`,
  page(
    "Eligibility",
    "",
    `<h2>Initial eligibility period</h2>
    <p class="copy">The initial eligibility period begins the day you become benefit eligible under your employer's eligibility guidelines and ends 30 days from that date. All benefits begin the first of the following month after two months of employment.</p>
    <h2>Dependents</h2>
    <p>You can enroll eligible dependents for medical and dental coverage. Eligible dependents generally include your spouse or domestic partner, children, stepchildren, legally adopted children, foster children, and children for whom you have legal custody.</p>
    <p>Eligible children are generally covered for medical and dental benefits until the end of the month following their 26th birthday.</p>
    <div class="callout">
      <h2>Qualified change in status</h2>
      <p>Unless you experience a life-changing qualifying event, you cannot make changes until the next open enrollment period. Qualifying events include marriage, divorce or legal separation, birth or adoption of a child, a change in dependent status, death of a qualified dependent, a change in service area, or a change in employment status or other employer-sponsored coverage.</p>
      <p>Requests must be received within 30 days of the event date. Late submissions are subject to carrier approval.</p>
    </div>`,
    4,
  ),
  page(
    "Medical Plan",
    "UnitedHealthcare",
    `<table>
      <thead><tr><th>Coverage</th><th>Freedom EPO 25/50/100 EPO 2D 26</th></tr></thead>
      <tbody>
        <tr class="band"><td colspan="2">General Plan Information</td></tr>
        <tr><td>Deductible</td><td>$0 medical deductible. Dental has a separate $100 individual / $200 family deductible. Prescription drug deductible is $150 per person and does not apply to Tier 1 drugs.</td></tr>
        <tr><td>Out-of-pocket maximum</td><td>Network: $7,300 individual / $14,600 family</td></tr>
        <tr><td>Network</td><td>EPO network coverage. Out-of-network services are generally not covered except as stated in the official plan documents.</td></tr>
        <tr class="band"><td colspan="2">Prescription Coverage</td></tr>
        <tr><td>Tier 1 / Tier 2 / Tier 3</td><td>$10 / $65 / $95 retail copays. Mail order: $25 / $162.50 / $237.50.</td></tr>
        <tr class="band"><td colspan="2">Covered Medical Highlights</td></tr>
        <tr><td>Preventive routine care</td><td>No charge for covered network preventive services</td></tr>
        <tr><td>Primary office visit</td><td>$25 copay per visit; under age 19: $5 copay</td></tr>
        <tr><td>Specialist office visit</td><td>$50 copay per visit</td></tr>
        <tr><td>Outpatient surgical procedure</td><td>$250 copay per service</td></tr>
        <tr><td>Emergency room</td><td>$750 copay per visit</td></tr>
        <tr><td>Urgent care center</td><td>$75 copay per visit</td></tr>
        <tr><td>Inpatient hospital</td><td>$500 copay per admission</td></tr>
      </tbody>
    </table>
    <p class="note">This is a shortened summary based on the Big Tows plan booklet OCR. Review the carrier documents for complete details, limitations, exclusions, and definitions.</p>`,
    5,
  ),
  page(
    "Medical Cost",
    "UnitedHealthcare - current system rates",
    `<div class="mini-grid">
      <div class="mini"><b>Payroll basis</b><span>${payPeriods} deductions per year</span></div>
      <div class="mini"><b>Employer share</b><span>Calculated from current system contribution percentages</span></div>
      <div class="mini"><b>Employee share</b><span>Shown monthly and per pay period</span></div>
    </div>
    <table class="cost-table">
      <thead><tr><th>Coverage tier</th><th>Total / mo.</th><th>ER / mo.</th><th>EE / mo.</th><th>ER / pay</th><th>EE / pay</th></tr></thead>
      <tbody>${costRows(health, payPeriods)}</tbody>
    </table>
    <p class="note">ER = Employer. EE = Employee. Per-pay amounts use ${payPeriods} payroll deductions and are rounded to cents.</p>`,
    6,
  ),
  page(
    "Dental Plan",
    "UnitedHealthcare Dental",
    `<table>
      <thead><tr><th>Coverage</th><th>National Options PPO 20 - P9915 / MAC</th></tr></thead>
      <tbody>
        <tr class="band"><td colspan="2">General Plan Information</td></tr>
        <tr><td>Deductible</td><td>$50 individual / $150 family</td></tr>
        <tr><td>Annual maximum benefit</td><td>$1,500 per person per calendar year</td></tr>
        <tr><td>Waiting period</td><td>No waiting period</td></tr>
        <tr><td>Network</td><td>Network and non-network benefits are available. Non-network reimbursement is based on the allowable amount.</td></tr>
        <tr class="band"><td colspan="2">Dental Services</td></tr>
        <tr><td>Preventive and diagnostic services</td><td>Plan pays 100%</td></tr>
        <tr><td>Basic services</td><td>Plan pays 80%</td></tr>
        <tr><td>Major services</td><td>Plan pays 50%</td></tr>
        <tr><td>Orthodontic services</td><td>Not covered according to the exclusions in the Big Tows booklet OCR</td></tr>
        <tr class="band"><td colspan="2">Examples of Covered Services</td></tr>
        <tr><td>Preventive</td><td>Oral evaluations, bitewing radiographs, cleanings, fluoride for covered children, sealants, and space maintainers subject to frequency limits.</td></tr>
        <tr><td>Basic and major</td><td>Restorations, emergency treatment, occlusal guards, extractions, oral surgery, endodontics, periodontics, crowns, dentures, and bridges subject to plan limits.</td></tr>
      </tbody>
    </table>
    <p class="note">This is a shortened summary based on the Big Tows dental booklet OCR. Review the certificate for complete limitations and exclusions.</p>`,
    7,
  ),
  page(
    "Dental Cost",
    "UnitedHealthcare Dental - current system rates",
    `<table class="cost-table">
      <thead><tr><th>Coverage tier</th><th>Total / mo.</th><th>ER / mo.</th><th>EE / mo.</th><th>ER / pay</th><th>EE / pay</th></tr></thead>
      <tbody>${costRows(dental, payPeriods)}</tbody>
    </table>
    <p class="note">ER = Employer. EE = Employee. Per-pay amounts use ${payPeriods} payroll deductions and are rounded to cents.</p>`,
    8,
  ),
  page(
    "Employee Contact List",
    "",
    `<table class="teal">
      <thead><tr><th>Carrier / contact</th><th>Phone</th><th>Website / email</th></tr></thead>
      <tbody>
        <tr><td>UnitedHealthcare Medical</td><td>1-800-444-6222</td><td>www.whyuhc.com / myuhc.com</td></tr>
        <tr><td>UnitedHealthcare Dental</td><td>Refer to ID card</td><td>myuhc.com</td></tr>
        <tr><td>${esc(employer)}</td><td>${esc(company.phone)}</td><td>${esc(company.website)}</td></tr>
        <tr><td>Company email</td><td></td><td>${esc(company.email)}</td></tr>
      </tbody>
    </table>
    <h2>Company</h2>
    <p>${esc(company.description)}</p>
    <p><b>Headquarters:</b> ${esc(company.headquarters)}<br><b>Industry:</b> ${esc(company.industry)}<br><b>Employee count:</b> ${esc(company.employeeCount)}</p>`,
    9,
  ),
  `<section class="page legal">
    <div class="legal-box">
      <p>The information in this guide is presented for illustrative purposes and is based on information provided by the employer, the Big Tows plan booklet OCR, and current system rate data. While every effort was taken to accurately summarize your benefits, discrepancies or errors are possible. In case of discrepancy between this guide and the official plan documents, the official plan documents will prevail. All information is confidential pursuant to the Health Insurance Portability and Accountability Act of 1996.</p>
      <p>${esc(employer)}<br>${esc(company.website)}</p>
    </div>
    <footer><span>Clarke</span><span>10</span></footer>
  </section>`,
];

const html = `<!doctype html><html><head><meta charset="utf-8">${css}</head><body>${pages.join(
  "",
)}</body></html>`;
return { css, pages, html };
}

const pageTitles = [
  "Cover",
  "Table of Contents",
  "Welcome",
  "Eligibility",
  "Medical Plan",
  "Medical Cost",
  "Dental Plan",
  "Dental Cost",
  "Employee Contact List",
  "Legal Disclaimer",
];

export async function loadBigTowsCompany(path = DATA_PATH) {
  const companyData = JSON.parse(await fs.readFile(path, "utf8"));
  return decode({ mapValue: { fields: companyData.fields } });
}

export async function renderBigTowsStylePreviewPages(
  company,
  payPeriods = PAY_PERIODS,
) {
  const { css, pages } = await buildBooklet(company, payPeriods);
  return pages.map((html, index) => ({
    index,
    title: pageTitles[index] || `Page ${index + 1}`,
    text: pageTitles[index] || "",
    html: `<!doctype html><html><head><meta charset="utf-8">${css}</head><body>${html}</body></html>`,
  }));
}

export async function renderBigTowsStyleHtml(company, payPeriods = PAY_PERIODS) {
  return (await buildBooklet(company, payPeriods)).html;
}

export async function generateBigTowsStylePdf(company, payPeriods = PAY_PERIODS) {
  const { html } = await buildBooklet(company, payPeriods, {
    sourceArtwork: true,
  });
  const localChrome = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
  const isLocal = existsSync(localChrome);
  const chromium = isLocal ? null : (await import("@sparticuz/chromium")).default;

  const browser = await puppeteer.launch({
    executablePath: isLocal ? localChrome : await chromium.executablePath(),
    headless: true,
    args: isLocal
      ? ["--no-sandbox", "--allow-file-access-from-files"]
      : [...chromium.args, "--allow-file-access-from-files"],
    defaultViewport: { width: 1020, height: 1320 },
  });

  try {
    const pageInstance = await browser.newPage();
    await pageInstance.setViewport({ width: 1020, height: 1320, deviceScaleFactor: 1 });
    pageInstance.setDefaultNavigationTimeout(0);
    await pageInstance.setContent(html, { waitUntil: "load", timeout: 0 });
    await pageInstance.emulateMediaType("screen");
    return Buffer.from(
      await pageInstance.pdf({
        format: "Letter",
        printBackground: true,
        preferCSSPageSize: true,
        margin: { top: 0, right: 0, bottom: 0, left: 0 },
      }),
    );
  } finally {
    await browser.close();
  }
}

async function main() {
  const company = await loadBigTowsCompany();
  const html = await renderBigTowsStyleHtml(company, PAY_PERIODS);
  const pdf = await generateBigTowsStylePdf(company, PAY_PERIODS);
  await fs.mkdir("tmp/pdfs", { recursive: true });
  await fs.writeFile("tmp/pdfs/bigtows-2025-style.html", html);
  await fs.mkdir("output/pdf", { recursive: true });
  await fs.writeFile(OUT_PATH, pdf);
  console.log(`Wrote ${OUT_PATH} (${pdf.length} bytes)`);
}

if (import.meta.url === pathToFileURL(process.argv[1] || "").href) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
