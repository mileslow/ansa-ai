import fs from "node:fs/promises";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { PDFDocument, StandardFonts } from "pdf-lib";
import * as XLSX from "xlsx";

const baseUrl = (
  process.env.PRODUCTION_BASE_URL || "https://ansa-benefits-studio.vercel.app"
).replace(/\/$/, "");
const firebaseIdToken = process.env.FIREBASE_ID_TOKEN || "";

async function request(body: Record<string, unknown>) {
  const response = await fetch(`${baseUrl}/api/booklet-pipeline`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${firebaseIdToken}`,
    },
    body: JSON.stringify(body),
  });
  const text = await response.text();
  let parsed: any;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error(`Production API returned ${response.status}: ${text.slice(0, 500)}`);
  }
  if (!response.ok && response.status !== 202)
    throw new Error(
      `Production API returned ${response.status}: ${JSON.stringify(parsed).slice(0, 1_000)}`,
    );
  return { status: response.status, body: parsed };
}

function rateWorkbook() {
  const workbook = XLSX.utils.book_new();
  const sheet = XLSX.utils.aoa_to_sheet([
    ["2026 Current Medical and Dental Plan Costs"],
    [
      "Plan",
      "Tier",
      "Monthly Premium",
      "ER Cost",
      "EE Cost",
      "EE Per Pay Period",
      "ER %",
      "# Enrolled",
    ],
    ["UHC Bronze 2026", "EE", 767.47, 500, 267.47, 123.45, "65%", 18],
    [null, "EE+Spouse", 1534.94, 750, 784.94, 362.28, "49%", 6],
    [null, "EE+Children", 1304.7, 650, 654.7, 302.17, "50%", 4],
    [null, "EE+Family", 2187.29, 1000, 1187.29, 548, "46%", 9],
    [
      "2026 Dental - UnitedHealthcare National Options PPO 20 Network",
      "EE",
      45,
      22.5,
      22.5,
      10.38,
      "50%",
      14,
    ],
    [null, "EE+Spouse", 90, 45, 45, 20.77, "50%", 5],
    [null, "EE+Children", 80, 40, 40, 18.46, "50%", 3],
    [null, "EE+Family", 135, 67.5, 67.5, 31.15, "50%", 7],
  ]);
  XLSX.utils.book_append_sheet(workbook, sheet, "26 pay periods");
  return Buffer.from(XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }));
}

async function employerSetupPdf(text: string) {
  const document = await PDFDocument.create();
  const font = await document.embedFont(StandardFonts.Helvetica);
  const bold = await document.embedFont(StandardFonts.HelveticaBold);
  let page = document.addPage([612, 792]);
  let y = 740;
  page.drawText("Completed 2026 Employer Benefits Setup", {
    x: 54,
    y,
    size: 16,
    font: bold,
  });
  y -= 32;
  for (const paragraph of text.split("\n").filter(Boolean)) {
    const words = paragraph.split(/\s+/);
    let line = "";
    const lines: string[] = [];
    for (const word of words) {
      const candidate = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(candidate, 10.5) > 500 && line) {
        lines.push(line);
        line = word;
      } else line = candidate;
    }
    if (line) lines.push(line);
    for (const renderedLine of lines) {
      if (y < 55) {
        page = document.addPage([612, 792]);
        y = 740;
      }
      page.drawText(renderedLine, { x: 54, y, size: 10.5, font });
      y -= 15;
    }
    y -= 6;
  }
  return Buffer.from(await document.save());
}

function answersFor(questions: any[]) {
  const contributionByTier: Record<string, number> = {
    employee: 500,
    employee_spouse: 750,
    employee_children: 650,
    family: 1000,
  };
  return Object.fromEntries(
    questions.map((question) => {
      const path = String(question.fieldPath);
      if (path === "employer.name") return [path, "Ansa Production Verification LLC"];
      if (path === "planYear.start") return [path, "2026-01-01"];
      if (path === "planYear.end") return [path, "2026-12-31"];
      if (path === "eligibility.waitingPeriod")
        return [path, "First of the month after 30 days of employment"];
      if (path === "plans.selected")
        return [
          path,
          [
            { planName: "UHC Bronze 2026", benefitType: "medical", carrier: "UnitedHealthcare" },
            {
              planName: "2026 Dental - UnitedHealthcare National Options PPO 20 Network",
              benefitType: "dental",
              carrier: "UnitedHealthcare",
            },
          ],
        ];
      if (path.endsWith(".ratePlanId") && question.options?.length)
        return [path, question.options[0]];
      const contribution = path.match(/^contributions\.[^.]+\.([^.]+)$/);
      if (contribution && contributionByTier[contribution[1]] !== undefined)
        return [
          path,
          {
            mode: "flat_monthly",
            value: contributionByTier[contribution[1]],
            payPeriods: 26,
          },
        ];
      throw new Error(`Live test cannot answer unexpected blocker: ${path}`);
    }),
  );
}

async function main() {
  if (!firebaseIdToken)
    throw new Error("FIREBASE_ID_TOKEN is required for the authenticated production smoke test");
  const medicalSbc = await fs.readFile(
    path.join(process.cwd(), "tests/fixtures/plans/uhc-bronze-2026.pdf"),
  );
  const instructions = `Current employer facts for this production verification booklet:
Employer: Ansa Production Verification LLC
Plan year: January 1, 2026 through December 31, 2026
Eligibility: Full-time employees are eligible first of the month after 30 days of employment.
Offered benefits: Medical, Dental, HRA, and FSA.
Selected current medical plan: UHC Bronze 2026.
Selected current dental plan: 2026 Dental - UnitedHealthcare National Options PPO 20 Network.
The HRA and FSA administrator is HealthEquity.
Human Resources and enrollment contact: Jordan Lee, 585-555-2200, benefits@ansa-verification.test.
Use the attached current rate and contribution workbook for all employee deductions.`;
  const employerPdf = await employerSetupPdf(instructions);
  const files = [
    {
      fileName: "filled-2026-employer-benefits-application.pdf",
      mimeType: "application/pdf",
      base64: employerPdf.toString("base64"),
    },
    {
      fileName: "2026-production-verification-rates.xlsx",
      mimeType:
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      base64: rateWorkbook().toString("base64"),
    },
    {
      fileName: "uhc-bronze-2026-sbc.pdf",
      mimeType: "application/pdf",
      base64: medicalSbc.toString("base64"),
    },
  ];

  const created = await request({
    action: "create_thread",
    companyId: `production-verification-${Date.now()}`,
    message:
      "Generate a current employee benefits booklet from the attached employer instructions, rates, and carrier SBC.",
    files,
  });
  const threadId = created.body.thread?.id;
  const fileIds = (created.body.files || []).map((file: any) => file.id);
  if (!threadId || fileIds.length !== files.length)
    throw new Error("Production thread did not persist all uploaded files");

  const started = await request({ action: "start", threadId, fileIds });
  let run = started.body.run;
  if (!run?.id) throw new Error("Production API returned no generation run");
  for (let attempt = 0; run.status === "blocked" && attempt < 3; attempt += 1) {
    const answers = answersFor(run.questions || []);
    const resumed = await request({ action: "answer", runId: run.id, answers });
    run = resumed.body.run;
  }
  if (run.status === "blocked")
    throw new Error(`Production run remained blocked: ${JSON.stringify(run.questions || [])}`);
  if (run.status !== "complete" || !run.pdfUrl)
    throw new Error(
      `Production run did not complete: ${JSON.stringify({ status: run.status, error: run.error })}`,
    );

  const status = await request({ action: "status", runId: run.id });
  if (status.body.run?.status !== "complete")
    throw new Error("Persisted production run is not complete");
  if (!(status.body.events || []).some((event: any) => event.stage === "Complete"))
    throw new Error("Persisted production events do not include Complete");
  const contentEvent = (status.body.events || []).find(
    (event: any) => event.stage === "Writing booklet content" && event.status === "complete",
  );
  if (!/grounded dynamic section/i.test(contentEvent?.message || ""))
    throw new Error(
      `Live content model did not complete successfully: ${contentEvent?.message || "missing event"}`,
    );

  const pdfResponse = await fetch(run.pdfUrl);
  if (!pdfResponse.ok)
    throw new Error(`Stored PDF download returned ${pdfResponse.status}`);
  const pdf = Buffer.from(await pdfResponse.arrayBuffer());
  if (pdf.subarray(0, 4).toString() !== "%PDF")
    throw new Error("Stored production artifact is not a PDF");
  const parsedPdf = await PDFDocument.load(pdf);
  const pages = parsedPdf.getPages();
  if (pages.length < 8) throw new Error(`Production PDF has only ${pages.length} pages`);
  for (const [index, page] of pages.entries()) {
    const { width, height } = page.getSize();
    if (Math.abs(width - 612) > 2 || Math.abs(height - 792) > 2)
      throw new Error(`Production PDF page ${index + 1} is not US Letter`);
  }

  const outputDirectory = path.join(process.cwd(), "output/pdf/live");
  await fs.mkdir(outputDirectory, { recursive: true });
  const outputPath = path.join(
    outputDirectory,
    "production-backend-live-benefits-guide.pdf",
  );
  await fs.writeFile(outputPath, pdf);
  const extractedText = execFileSync("pdftotext", [outputPath, "-"], {
    encoding: "utf8",
  });
  const expectedText = [
    "Ansa Production Verification LLC",
    "UHC Bronze 2026",
    "2026 Dental - UnitedHealthcare National Options PPO 20 Network",
    "HEALTH REIMBURSEMENT ACCOUNT",
    "FLEXIBLE SPENDING ACCOUNT",
    "26 payroll deductions",
    "$123.45",
    "$547.98",
  ];
  const missingText = expectedText.filter((value) => !extractedText.includes(value));
  if (missingText.length)
    throw new Error(`Production PDF is missing expected generated text: ${missingText.join(", ")}`);
  if (/undefined|null|placeholder|invalid date|\bNaN\b/i.test(extractedText))
    throw new Error("Production PDF contains placeholder or invalid generated text");
  if (extractedText.includes("52 payroll deductions"))
    throw new Error("Production PDF ignored the workbook's 26-pay-period basis");
  console.log(
    JSON.stringify(
      {
        baseUrl,
        threadId,
        runId: run.id,
        status: run.status,
        pdfStoragePath: run.pdfStoragePath,
        outputPath,
        bytes: pdf.length,
        pageCount: pages.length,
        eventCount: status.body.events.length,
        contentModelResult: contentEvent.message,
        verifiedTextChecks: expectedText.length,
        stages: [...new Set(status.body.events.map((event: any) => event.stage))],
      },
      null,
      2,
    ),
  );
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
